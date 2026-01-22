import { all, fork } from "redux-saga/effects";
import lessonsSaga from "@/features/lessons/lessonsSaga";

export default function* rootSaga() {
  yield all([fork(lessonsSaga)]);
}
