// nova.lesson without an undo step (module 0, for module g, request of 19/11
// evening): store.setLesson writes the document's nova.lesson and leaves the
// undo history as it is; Undo and Redo do not touch nova.lesson (the lesson's
// progress is not a step of the design).

import { check, done } from "./testkit";
import { emptyDoc, useStore } from "../../store";
import type { LessonState, StitchDocument } from "../../types";

const st = () => useStore.getState();
const lesson = (stepId: string, completed: string[] = []): LessonState => ({ lessonId: "g.primo-ricamo", lessonRev: 1, lang: "it", stepId, status: "inProgress", completedSteps: completed });
const start: StitchDocument = { ...emptyDoc(), name: "A" };
useStore.setState({ doc: start, past: [], future: [], saved: true });

st().setLesson(lesson("s1"));
check(st().doc.nova?.lesson?.stepId === "s1", "setLesson writes nova.lesson");
check(st().past.length === 0 && st().future.length === 0, "no undo step");
check(st().doc.name === "A" && st().doc.objects === start.objects, "nothing else of the design changes");
check(st().saved === false, "the project has unsaved changes (the lesson is saved with it)");

// a design change, then the lesson moves on
st().commit((d) => ({ ...d, name: "B" }));
st().setLesson(lesson("s2", ["s1"]));
check(st().past.length === 1, "only the design change is an undo step");
st().undo();
check(st().doc.name === "A", "Undo takes back the design change");
check(st().doc.nova?.lesson?.stepId === "s2" && st().doc.nova?.lesson?.completedSteps.join() === "s1", "Undo does not touch nova.lesson");
st().setLesson(lesson("s3", ["s1", "s2"]));
check(st().future.length === 1, "setLesson keeps the redo step");
st().redo();
check(st().doc.name === "B", "Redo gives the design change back");
check(st().doc.nova?.lesson?.stepId === "s3", "Redo does not touch nova.lesson");

// the lesson ends: removed without a step; Undo does not bring it back
st().setLesson(null);
check(st().doc.nova?.lesson === null && st().past.length === 1, "setLesson(null): the lesson is over, no undo step");
st().undo();
check(st().doc.nova?.lesson === null, "Undo does not bring an ended lesson back");
check(st().doc.name === "A", "(Undo still undoes the design)");

// a document with no lesson: Undo and Redo do not add one
useStore.setState({ doc: { ...emptyDoc(), name: "C" }, past: [], future: [] });
st().commit((d) => ({ ...d, name: "D" }));
st().undo();
check(st().doc.nova?.lesson === undefined, "no lesson: Undo adds none");

done("nova.lesson senza passo di annulla");
