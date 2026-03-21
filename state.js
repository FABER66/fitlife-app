// STATO
var state = {
  user: null,
  currentDate: dkey(new Date()),
  food: { aiItems: [] },
  workout: {
    openExercises: {},
    timer: { seconds: 0, running: false, intervalId: null },
    scanExercises: []
  }
};
