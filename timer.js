// TIMER
function togTimer() {
  if (state.workout.timer.running) {
    clearInterval(state.workout.timer.intervalId); state.workout.timer.running = false;
    document.getElementById('tfab').className = 'tfab';
  } else {
    state.workout.timer.running = true;
    document.getElementById('tfab').className = 'tfab on';
    state.workout.timer.intervalId = setInterval(function() {
      state.workout.timer.seconds++;
      var m = String(Math.floor(state.workout.timer.seconds/60)).padStart(2,'0');
      var s = String(state.workout.timer.seconds % 60).padStart(2,'0');
      document.getElementById('tdisp').textContent = m + ':' + s;
    }, 1000);
  }
}
