// Wires up the page once all data and modules are loaded.
(function () {
  "use strict";
  const S = window.RubiconStory;
  const P = window.RubiconPlay;
  const C = window.RubiconCharts;
  const $ = (id) => document.getElementById(id);

  S.hero();
  S.crossing();
  const play = P.playApp();
  S.games((key) => play.load(key));
  C.askViz($("askviz"));
  S.terminal();
  C.overrideChart($("chart-override"));
  C.lateChart($("chart-late"));
  C.gapLineChart($("chart-gapline"));
  P.quizApp();
  C.resultsTables($("results-app"));
  S.chrome();

  $("copy-bib").addEventListener("click", async (e) => {
    try {
      await navigator.clipboard.writeText($("bibtex").textContent);
      e.target.textContent = "Copied";
    } catch {
      const r = document.createRange();
      r.selectNodeContents($("bibtex"));
      getSelection().removeAllRanges();
      getSelection().addRange(r);
      e.target.textContent = "Selected";
    }
    setTimeout(() => (e.target.textContent = "Copy"), 1600);
  });
})();
