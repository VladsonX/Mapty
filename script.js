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
  #markers = [];
  #modalDelete = document.querySelector('.delete-modal');
  constructor() {
    this._getPosition();
    this._getLocalStorage();

    // Event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    containerWorkouts.addEventListener('click', this._editWorkout.bind(this));
    containerWorkouts.addEventListener(
      'click',
      this._showWarningWindow.bind(this),
    );
    document
      .querySelector('#delete-modal__yes')
      .addEventListener('click', this._deleteWorkout.bind(this));
    document
      .querySelector('#delete-modal__no')
      .addEventListener('click', this._hideWarningModal.bind(this));
    document.addEventListener('click', this._cancelUpdate.bind(this));
  }
  _moveToPopup(e) {
    const previousActiveWorkout =
      e.currentTarget.querySelector('.workout_active');
    if (previousActiveWorkout)
      previousActiveWorkout.classList.remove('workout_active');

    const workoutEl = e.target.closest('li.workout');
    if (!workoutEl) return;
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

  _showForm(e) {
    this.#mapEvent = e;
    form.classList.remove('hidden');
    inputDistance.focus();
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
  _removeEditForm() {
    document.querySelector('.form_edit')?.remove();
  }

  _toggleElevationField() {
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
  }
  _toggleElevationFieldEdit() {
    const inputCadence = document.querySelector(
      '.form_edit .form__input--cadence',
    );

    const inputElevation = document.querySelector(
      '.form_edit .form__input--elevation',
    );

    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _updateWorkout(e, workout) {
    e.preventDefault();

    if (!workout) return;

    const id = workout.id;
    const date = workout.date;
    let updatedWorkout;
    let cadence, elevationGain;
    const type = document.querySelector('.form_edit .form__input--type').value;
    const distance = +document.querySelector(
      '.form_edit .form__input--distance',
    ).value;
    const duration = +document.querySelector(
      '.form_edit .form__input--duration',
    ).value;

    if (type === 'running') {
      cadence = +document.querySelector('.form_edit .form__input--cadence')
        .value;
      updatedWorkout = new Running(workout.coords, distance, duration, cadence);
    }

    if (type === 'cycling') {
      elevationGain = +document.querySelector(
        '.form_edit .form__input--elevation',
      ).value;
      updatedWorkout = new Cycling(
        workout.coords,
        distance,
        duration,
        elevationGain,
      );
    }
    updatedWorkout.id = id;
    updatedWorkout.date = date;

    const position = this.#workouts.findIndex(workout => workout.id === id);

    this.#workouts.splice(position, 1, updatedWorkout);
    this._removeEditForm();

    this._renderWorkout(updatedWorkout, position);
    this._setLocalStorage(e);
    this._updateWorkoutMap(updatedWorkout);
  }
  _updateWorkoutMap(workout) {
    const markerToUpdate = this.#markers.find(
      marker => marker.workoutId === workout.id,
    );
    if (!markerToUpdate) return;

    markerToUpdate.setPopupContent(
      `${workout.type === 'running' ? '🏃‍♂️' : '🚴'} ${workout.description}`,
    );

    const popup = markerToUpdate.getPopup();
    popup.options.class = `${workout.type}-popup`;
    const popupElement = popup.getElement();

    if (popupElement) {
      popupElement.classList.remove('running-popup', 'cycling-popup');
      popupElement.classList.add(`${workout.type}-popup`);
    }
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

    // Set local storage to workouts array
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
    const marker = L.marker(workout.coords)
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
    marker.workoutId = workout.id;
    this.#markers.push(marker);
  }

  _renderWorkout(workout, position) {
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
          <svg data-id='${workout.id}' class='workout__delete' viewBox="0 0 1024 1024" fill="#000000" class="icon" version="1.1" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M512 897.6c-108 0-209.6-42.4-285.6-118.4-76-76-118.4-177.6-118.4-285.6 0-108 42.4-209.6 118.4-285.6 76-76 177.6-118.4 285.6-118.4 108 0 209.6 42.4 285.6 118.4 157.6 157.6 157.6 413.6 0 571.2-76 76-177.6 118.4-285.6 118.4z m0-760c-95.2 0-184.8 36.8-252 104-67.2 67.2-104 156.8-104 252s36.8 184.8 104 252c67.2 67.2 156.8 104 252 104 95.2 0 184.8-36.8 252-104 139.2-139.2 139.2-364.8 0-504-67.2-67.2-156.8-104-252-104z" fill=""></path><path d="M707.872 329.392L348.096 689.16l-31.68-31.68 359.776-359.768z" fill=""></path><path d="M328 340.8l32-31.2 348 348-32 32z" fill=""></path></g></svg>
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
    if (Number.isFinite(position)) {
      const workoutElements = [
        ...containerWorkouts.querySelectorAll('.workout'),
      ];
      workoutElements[position].insertAdjacentHTML('beforebegin', html);
    } else form.insertAdjacentHTML('afterend', html);
  }
  _editWorkout(e) {
    const editBtn = e.target.closest('.workout__edit');
    if (!editBtn) return;

    this._removeEditForm();
    const hiddenWorkout = document.querySelector('.workout__dnone');
    if (hiddenWorkout) hiddenWorkout.classList.remove('workout__dnone');

    const workoutEl = editBtn.closest('.workout');
    const workoutElements = [...containerWorkouts.querySelectorAll('.workout')];

    const position = workoutElements.findIndex(
      element => element === workoutEl,
    );
    const workout = this.#workouts.find(
      workout => workout.id === workoutEl.dataset.id,
    );

    this._hideWorkoutEl(position);
    this._showEditForm(position, workout);
  }

  _cancelUpdate(e) {
    const formEdit = document.querySelector('.form_edit');
    if (!formEdit) return;
    if (e.target.closest('.form_edit')) return;
    if (e.target.closest('.workout__edit')) return;

    this._removeEditForm();
    const hiddenWorkout = document.querySelector('.workout__dnone');
    if (hiddenWorkout) {
      hiddenWorkout.classList.remove('workout__dnone');
    }
  }

  _showEditForm(position, workout) {
    if (!Number.isFinite(position)) return;

    const html = `
    <form class="form form_edit">
      <div class="form__row">
        <label class="form__label">Type</label>
        <select class="form__input form__input--type">
          <option ${workout.type === 'running' ? 'selected' : ''} value="running">Running</option>
          <option ${workout.type === 'cycling' ? 'selected' : ''} value="cycling">Cycling</option>
        </select>
      </div>
      <div class="form__row">
        <label class="form__label">Distance</label>
        <input value='${workout.distance}' class="form__input form__input--distance" placeholder="km" />
      </div>
      <div class="form__row">
        <label class="form__label">Duration</label>
        <input value='${workout.duration}'
          class="form__input form__input--duration"
          placeholder="min"
        />
      </div>
          
      <div class="form__row ${workout.type === 'cycling' ? 'form__row--hidden' : ''}">
        <label class="form__label">Cadence</label>
        <input
        value='${workout.cadence ?? 0}'
          class="form__input form__input--cadence"
          placeholder="step/min"
        />
      </div>
      <div class="form__row ${workout.type === 'running' ? 'form__row--hidden' : ''}">
        <label class="form__label">Elev Gain</label>
        <input value='${workout.elevationGain ?? 0}'
          class="form__input form__input--elevation"
          placeholder="meters"
        />
      </div>
      <button class="form__btn">OK</button>
    </form>`;

    const workoutElements = [...containerWorkouts.querySelectorAll('.workout')];
    workoutElements[position].insertAdjacentHTML('beforebegin', html);
    containerWorkouts
      .querySelector('.form_edit .form__input--distance')
      .focus();

    const formEdit = document.querySelector('.form_edit');
    const typeInput = formEdit.querySelector('.form__input--type');
    typeInput.addEventListener('change', this._toggleElevationFieldEdit);
    formEdit.addEventListener('submit', e => this._updateWorkout(e, workout));
  }

  _hideWorkoutEl(position) {
    const workoutElements = [...containerWorkouts.querySelectorAll('.workout')];
    const workoutEl = workoutElements[position];
    workoutEl.classList.add('workout__dnone');
  }
  _revealWorkoutEl(position) {
    const workoutElements = [...containerWorkouts.querySelectorAll('.workout')];
    const workoutEl = workoutElements[position];
    workoutEl.classList.remove('workout__dnone');
  }
  _showWarningWindow(e) {
    const elementClicked = e.target.closest('.workout__delete');
    if (!elementClicked) return;

    this.#modalDelete.classList.remove('hidden');

    const workoutEl = elementClicked.closest('.workout');
    const workoutId = workoutEl.dataset.id;

    this.#modalDelete.dataset.workoutId = workoutId;
  }
  _deleteWorkout(e) {
    const idToDelete = this.#modalDelete.dataset.workoutId;
    console.log(idToDelete);

    const position = this.#workouts.findIndex(elem => elem.id === idToDelete);
    this.#workouts.splice(position, 1);
    this._removeWorkoutElement(idToDelete);
    this._setLocalStorage(e);
    this._hideWarningModal();
  }
  _removeWorkoutElement(id) {
    const workoutToRemove = [
      ...containerWorkouts.querySelectorAll('.workout'),
    ].find(elem => elem.dataset.id === id);
    workoutToRemove.remove();
    this._removeWorkoutMap(id);
  }
  _removeWorkoutMap(id) {
    const indexToRemove = this.#markers.findIndex(
      marker => marker.workoutId === id,
    );
    if (indexToRemove === -1) return;
    const markerToRemove = this.#markers[indexToRemove];
    this.#map.removeLayer(markerToRemove);
    this.#markers.splice(indexToRemove, 1);
  }
  _hideWarningModal() {
    this.#modalDelete.classList.add('hidden');
  }
  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
