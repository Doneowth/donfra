import { configureStore } from "@reduxjs/toolkit";
import createSagaMiddleware from "redux-saga";
import lessonsReducer from "@/features/lessons/lessonsSlice";
import rootSaga from "./rootSaga";

const sagaMiddleware = createSagaMiddleware();

export const makeStore = () => {
  const store = configureStore({
    reducer: {
      lessons: lessonsReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        thunk: false,
        serializableCheck: {
          // Ignore excalidraw data which may contain non-serializable values
          ignoredPaths: ["lessons.bySlug"],
          ignoredActions: [
            "lessons/fetchLessonSuccess",
            "lessons/createLessonRequest",
            "lessons/updateLessonRequest",
          ],
        },
      }).concat(sagaMiddleware),
    devTools: process.env.NODE_ENV !== "production",
  });

  sagaMiddleware.run(rootSaga);

  return store;
};

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
