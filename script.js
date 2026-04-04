'use strict';

class Workout {
  date = new Date();
  id = crypto.randomUUID();
  constructor(coords, distance, duration) {
    this.coords = coords; // [ltd, lng]
    this.distance = distance; // km
    this.duration = duration; // min
  }
  _setDescription() {
    let options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    this.description = `${this.type.replace(this.type[0], this.type[0].toUpperCase())} on ${new Intl.DateTimeFormat(navigator.language, options).format(this.date)}`;
  }
}

class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }
  calcPace() {
    this.pace = this.duration / this.distance; // h/km
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }
  calcSpeed() {
    this.speed = this.distance / (this.duration / 60); // km/h
    return this.speed;
  }
}

const form = document.querySelector('.form_main');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

// APPLICATION
class App {
  #mapSpeed = 13;
  #map;
  #mapEvent;
  #workouts = [];
  constructor() {
    this._getPosition();
    this._getLocalStorage();

    // Event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    containerWorkouts.addEventListener('click', this._editWorkout.bind(this));
  }
  _moveToPopup(e) {
    const previousActiveWorkout =
      e.currentTarget.querySelector('.workout_active');
    if (previousActiveWorkout)
      previousActiveWorkout.classList.remove('workout_active');
    const workoutEl = e.target.closest('li.workout');
    workoutEl.classList.add('workout_active');

    // get id of workout
    const id = workoutEl?.dataset.id;
    if (!id) return;

    // find workout from the array
    const workout = this.#workouts.find(workout => workout.id === id);

    // view into workout on the map
    this.#map.flyTo(workout.coords, this.#mapSpeed, {
      animate: true,
      duration: 0.5,
    });
  }
  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get a geoposition!');
        },
      );
    }
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    this.#map = L.map('map').setView([latitude, longitude], 13);

    L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    }).addTo(this.#map);

    this.#map.on('click', this._showForm.bind(this));
    this.#workouts.forEach(workout => {
      this._renderWorkoutMarker(workout);
    });
  }

  _showForm(e, position) {
    this.#mapEvent = e;
    console.log(this.#mapEvent);

    const html = `
    <form class="form form_edit">
          <div class="form__row">
            <label class="form__label">Type</label>
            <select class="form__input form__input--type">
              <option value="running">Running</option>
              <option value="cycling">Cycling</option>
            </select>
          </div>
          <div class="form__row">
            <label class="form__label">Distance</label>
            <input class="form__input form__input--distance" placeholder="km" />
          </div>
          <div class="form__row">
            <label class="form__label">Duration</label>
            <input
              class="form__input form__input--duration"
              placeholder="min"
            />
          </div>
          <div class="form__row">
            <label class="form__label">Cadence</label>
            <input
              class="form__input form__input--cadence"
              placeholder="step/min"
            />
          </div>
          <div class="form__row form__row--hidden">
            <label class="form__label">Elev Gain</label>
            <input
              class="form__input form__input--elevation"
              placeholder="meters"
            />
          </div>
          <button class="form__btn">OK</button>
        </form>`;
    if (Number.isFinite(position)) {
      const workoutElements = [
        ...containerWorkouts.querySelectorAll('.workout'),
      ];
      workoutElements[position - 1].insertAdjacentHTML('afterend', html);
      console.log('afterend');
    } else {
      console.log('afterbegin');

      containerWorkouts.insertAdjacentHTML('afterbegin', html);
      form.classList.remove('hidden');
      inputDistance.focus();
    }
  }

  _hideForm() {
    inputCadence.value =
      inputDistance.value =
      inputDuration.value =
      inputElevation.value =
        '';
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    e.preventDefault();
    let workout;
    const { lat, lng } = this.#mapEvent.latlng;
    const coordsClicked = [lat, lng];

    // get data from the form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;

    const validInputs = (...values) =>
      values.every(value => Number.isFinite(value));
    const allPositiveNumbers = (...values) => values.every(value => value > 0);

    // if workout type is running - new Runnning instance
    if (type === 'running') {
      const cadence = +inputCadence.value;

      if (
        !validInputs(distance, duration, cadence) ||
        !allPositiveNumbers(distance, duration, cadence)
      )
        return alert('Inputs must be positive numbers!');
      workout = new Running(coordsClicked, distance, duration, cadence);
      console.log(workout);
    }

    // if workout type is cycling - new Cycling instance
    if (type === 'cycling') {
      const elevationGain = +inputElevation.value;
      console.log(elevationGain);

      if (
        !validInputs(distance, duration, elevationGain) ||
        !allPositiveNumbers(distance, duration)
      )
        return alert('Inputs must be positive numbers!');

      workout = new Cycling(coordsClicked, distance, duration, elevationGain);
      console.log(workout);
    }

    // push new workout to workouts array
    this.#workouts.push(workout);

    // render new workout on the list
    this._renderWorkoutMarker(workout);

    // render new workout on the map
    this._renderWorkout(workout);

    // clear and hide form
    this._hideForm();

    // Ser local storage to workouts array
    this._setLocalStorage(e);
  }

  _setLocalStorage(e) {
    e.preventDefault();
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }
  _getLocalStorage() {
    const savedWorkouts = JSON.parse(localStorage.getItem('workouts'));

    if (!savedWorkouts) return;
    this.#workouts = savedWorkouts;

    this.#workouts.forEach(workout => {
      this._renderWorkout(workout);
    });
  }

  _renderWorkoutMarker(workout) {
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          minWidth: 50,
          maxWidth: 200,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        }),
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴'} ${workout.description}`,
      )
      .openPopup();
  }

  _renderWorkout(workout) {
    const html = `
        <li class="workout workout--${workout.type}" data-id="${workout.id}">
            <svg
                data-id='${workout.id}'
                class="workout__edit"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="lucide lucide-pencil-icon lucide-pencil"
            >
            <path
              d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"
            />
            <path d="m15 5 4 4" />
          </svg>
          <h2 class="workout__title">${workout.type.replace(workout.type[0], workout.type[0].toUpperCase())} on ${new Intl.DateTimeFormat(navigator.language).format(Date.parse(workout.date))}</h2>
          <div class="workout__details">
            <span class="workout__icon">${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'}</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.type === 'running' ? workout.pace.toFixed(1) : workout.speed.toFixed(1)}</span>
            <span class="workout__unit">${workout.type === 'running' ? 'min/km' : 'km/h'}</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">${workout.type === 'running' ? '🦶🏼' : '⛰️'}</span>
            <span class="workout__value">${workout.type === 'running' ? workout.cadence : workout.elevationGain}</span>
            <span class="workout__unit">${workout.type === 'running' ? 'spm' : 'm'}</span>
          </div>
        </li>
        `;
    form.insertAdjacentHTML('afterend', html);
  }
  _editWorkout(e) {
    const editBtn = e.target;
    if (!editBtn.classList.contains('workout__edit')) return;

    const workoutEl = editBtn.closest('.workout');
    console.log(workoutEl);

    const workoutElements = [...containerWorkouts.querySelectorAll('.workout')];

    const position = workoutElements.findIndex(
      element => element === workoutEl,
    );
    console.log(position);

    const workout = this.#workouts.find(
      workout => workout.id === workoutEl.dataset.id,
    );
    console.log(workout);

    this._hideWorkoutEl(position);

    this._showForm(workout.latlng, position);
  }
  _hideWorkoutEl(position) {
    const workoutElements = [...containerWorkouts.querySelectorAll('.workout')];
    const workoutEl = workoutElements[position];
    workoutEl.classList.add('workout__dnone');
  }
  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
