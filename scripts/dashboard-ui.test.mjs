import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../public/dashboard-ui.js', import.meta.url),'utf8');
function render(data) {
  const elements = new Map();
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector,{textContent:'',style:{},attributes:{},setAttribute(k,v){this.attributes[k]=v;},querySelector(){return element('bar');}});
    return elements.get(selector);
  };
  const context={window:{},location:{hash:'#plan'},addEventListener(){},document:{querySelector:element,querySelectorAll:s=>s==='[data-view]'||s==='.account-view'?[]:[element(s)]},Intl,Number,String,Math};
  vm.runInNewContext(source,context);
  context.window.renderTreenaDashboard(data);
  return element;
}
test('included minutes and proportional usage render from account data',()=>{
 const el=render({name:'Jamie Davis',usage:{minutesIncluded:30,minutesUsed:12},billing:{overage:'.15'}});
 assert.equal(el('[data-minutes-remaining]').textContent,'18');
 assert.equal(el('bar').style.width,'40%');
 assert.equal(el('[data-overage-cost]').textContent,'$0.00');
});
test('overage is estimated and progress stays within its accessible bounds',()=>{
 const el=render({usage:{minutesIncluded:30,minutesUsed:42.5},billing:{overage:'.15'}});
 assert.equal(el('[data-minutes-remaining]').textContent,'0');
 assert.equal(el('[data-overage-minutes]').textContent,'12.5');
 assert.equal(el('[data-overage-cost]').textContent,'$1.88');
 assert.equal(el('bar').style.width,'100%');
 assert.equal(el('.meter').attributes['aria-valuenow'],'30');
});
test('missing metrics do not produce NaN or invented identity',()=>{
 const el=render({});assert.equal(el('[data-profile-email]').textContent,'Not available');
 assert.equal(el('bar').style.width,'0%');assert.equal(el('[data-minutes-remaining]').textContent,'0');
});
test('profile values remain text and retention preference reflects account data',()=>{
 const el=render({name:'<script>alert(1)</script>',user:{retain_call_artifacts:true}});
 assert.equal(el('[data-profile-name]').textContent,'<script>alert(1)</script>');
 assert.equal(el('#dashboard-retain').checked,true);
});
