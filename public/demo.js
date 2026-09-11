(() => {
  const stage = document.querySelector("[data-demo-stage]");
  const soon = document.getElementById("soon");
  const watch = document.getElementById("watch-call");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let timers = [];
  let seconds = 39;

  const clearTimers = () => {
    timers.forEach((id) => clearTimeout(id));
    timers = [];
  };

  const show = (el, on) => {
    if (!el) return;
    el.classList.toggle("is-hidden", !on);
  };

  const setState = (state) => {
    stage.dataset.state = state;
    document.querySelectorAll("[data-line]").forEach((node) => {
      const line = node.dataset.line;
      if (line === "calling") show(node, true);
      if (line === "complete" || line === "stamp-end" || line === "aisle") {
        show(node, state === "done");
      }
    });
    show(document.querySelector('[data-caption="speaking"]'), state === "calling");
    show(document.querySelector('[data-caption="asking"]'), state === "asking");
    show(document.querySelector('[data-caption="done"]'), state === "done");

    const status = document.querySelector("[data-call-status]");
    const timer = document.querySelector("[data-timer]");
    if (status) status.textContent = state === "done" ? "Call ended" : "Treena is calling";
    if (state === "calling") seconds = 39;
    if (state === "asking") seconds = 40;
    if (state === "done") seconds = 42;
    if (timer) timer.textContent = `00:${String(seconds).padStart(2, "0")}`;
  };

  const play = () => {
    clearTimers();
    if (reduced) {
      setState("done");
      return;
    }
    setState("calling");
    timers.push(setTimeout(() => setState("asking"), 3200));
    timers.push(setTimeout(() => setState("done"), 6400));
  };

  const onView = () => {
    if (!stage) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            play();
            io.disconnect();
          }
        });
      },
      { threshold: 0.35 }
    );
    io.observe(stage);
  };

  document.querySelectorAll("[data-cta]").forEach((btn) => {
    btn.addEventListener("click", () => {
      soon.hidden = false;
      clearTimeout(soon._hide);
      soon._hide = setTimeout(() => {
        soon.hidden = true;
      }, 4200);
    });
  });

  if (watch) {
    watch.addEventListener("click", () => {
      play();
    });
  }

  if (reduced) setState("done");
  else onView();
})();
