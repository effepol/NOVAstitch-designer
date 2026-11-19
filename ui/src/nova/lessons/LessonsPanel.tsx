// Module g: the Lessons panel (a tab of the layers panel). With no lesson
// running, the list of the lessons for the current mode, grouped by path; with
// one running, the box of the current step: its text, the hint when the check
// does not pass, Reset and Next.

import { useEffect, useRef, useState } from "react";
import { t, useLanguage } from "../core/i18n";
import { useRegistry } from "../core/registry";
import type { Lang, LoadedLesson } from "./lesson";
import { LESSON_PATHS } from "./lesson";
import { availableLessons, currentStep, lessonProgress, nextStep, refusedLessons, resetLesson, startLesson, stopLesson, useLessons } from "./engine";
import { reloadLessons } from "./install";
import "./texts";

const BOX = { padding: 12, boxSizing: "border-box" } as const;

function StepBox({ lang }: { lang: Lang }) {
  const cur = currentStep()!;
  const { lesson, step, index, count, status, hint } = cur;
  if (status === "done")
    return (
      <div className="props" style={BOX} data-nova-anchor="g.step">
        <p>
          <b>{lesson.title[lang]}</b>
        </p>
        <p className="hint">{t("g.panel.completed")}</p>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <button className="btn ghost" onClick={() => resetLesson("start")}>
            {t("g.panel.again")}
          </button>
          <button className="btn primary" onClick={() => stopLesson()}>
            {t("g.panel.backToList")}
          </button>
        </div>
      </div>
    );
  return (
    <div className="props" style={BOX} data-nova-anchor="g.step">
      <p>
        <b>{lesson.title[lang]}</b>
      </p>
      <p className="hint">{t("g.panel.stepOf", { n: index + 1, count })}</p>
      <p style={{ whiteSpace: "pre-wrap" }}>{step.text[lang]}</p>
      {hint && (
        <p className="hint warn" role="status" data-nova-anchor="g.hint">
          {step.hint[lang]}
        </p>
      )}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <button className="btn ghost" data-nova-anchor="g.reset" title={t(step.reset === "start" ? "g.panel.resetStartTitle" : "g.panel.resetStepTitle")} onClick={() => resetLesson()}>
          {t("g.panel.reset")}
        </button>
        <button className="btn primary" data-nova-anchor="g.next" onClick={() => nextStep()}>
          {t("g.panel.next")}
        </button>
        <button className="btn ghost" onClick={() => stopLesson()}>
          {t("g.panel.leave")}
        </button>
      </div>
    </div>
  );
}

function LessonRow({ lesson, lang }: { lesson: LoadedLesson; lang: Lang }) {
  const p = lessonProgress()?.get(lesson.id);
  const state = p && p.rev === lesson.rev ? (p.status === "done" ? t("g.panel.done") : t("g.panel.inProgress")) : "";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
      <span style={{ flex: 1, minWidth: 0 }} title={t("g.panel.steps", { n: lesson.steps.length })}>
        {lesson.title[lang]}
        {state ? <span className="hint"> · {state}</span> : null}
      </span>
      <button className="btn sm" data-nova-anchor="g.start" onClick={() => startLesson(lesson.id)}>
        {t("g.panel.start")}
      </button>
    </div>
  );
}

/** The panel, drawn again when the language, the lessons or the registry change. */
export function LessonsPanel() {
  const lang = useLanguage();
  useLessons();
  useRegistry();
  // the side panel can be narrower than its column (many tabs): keep to what is seen, so texts wrap inside it
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | undefined>(undefined);
  useEffect(() => {
    const panel = ref.current?.closest(".side-panel") as HTMLElement | null;
    if (!panel || typeof ResizeObserver === "undefined") return;
    const fit = () => setWidth(panel.clientWidth);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(panel);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ maxWidth: width }}>
      <LessonsView lang={lang} />
    </div>
  );
}

/** What the panel shows, in `lang`. */
export function LessonsView({ lang }: { lang: Lang }) {
  if (currentStep()) return <StepBox lang={lang} />;
  const list = availableLessons();
  const refused = refusedLessons();
  return (
    <div className="props" style={BOX} data-nova-anchor="g.panel">
      {list.length === 0 && <p className="hint">{t("g.panel.none")}</p>}
      {LESSON_PATHS.map((path) => {
        const group = list.filter((l) => l.path === path);
        if (!group.length) return null;
        return (
          <div key={path}>
            <p>
              <b>{t(`g.path.${path}`)}</b>
            </p>
            {group.map((l) => (
              <LessonRow key={l.id} lesson={l} lang={lang} />
            ))}
          </div>
        );
      })}
      {refused.length > 0 && (
        <details>
          <summary className="hint warn">{t("g.panel.refused", { n: refused.length })}</summary>
          {refused.map((e) => (
            <p key={e.folder} className="hint">
              {e.message}
            </p>
          ))}
        </details>
      )}
      <button className="btn ghost" data-nova-anchor="g.reload" title={t("g.panel.reloadTitle")} onClick={() => void reloadLessons()}>
        {t("g.panel.reload")}
      </button>
    </div>
  );
}
