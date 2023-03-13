'use strict';

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const seeAllWorkOutOnMap = document.getElementById('see-workout-onmap');
const seeBtnClass = document.querySelector('.seebtn-hidden');
const deleteAllWorkoutBtn = document.getElementById('deleteall-workout');
const sortBtn = document.getElementById('sort-btn');

class workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);

  constructor(coords, distance, duration) {
    // this.date = ...
    // this.id = ...
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    this.description = `${this.type[0].toUpperCase(0)}${this.type.slice(
      1
    )} on ${months[this.date.getMonth()]} ${this.date.getDate()}`;
  }
}

class Running extends workout {
  type = 'running';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevetionGain) {
    super(coords, distance, duration);
    this.elevetionGain = elevetionGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

//////////////////////////////////////////////////////////////
// APPLICATION ARCHITECTURE
class App {
  #map;
  #mapZoomLevel = 17;
  #mapEvent;
  #workout = [];
  #clicks;

  constructor() {
    // delete and see workouts, hiding and disabled
    seeBtnClass.disabled = true;
    deleteAllWorkoutBtn.disabled = true;
    sortBtn.disabled = true;

    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attache event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    deleteAllWorkoutBtn.addEventListener(
      'click',
      this._deletWorkOut.bind(this)
    );
    seeAllWorkOutOnMap.addEventListener(
      'click',
      this._seeAllWorkOut.bind(this)
    );
    // NEW
    sortBtn.addEventListener('click', this._sortBtnByKM.bind(this));
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get locatin');
        }
      );
  }

  _loadMap(position) {
    // See all workout button activate
    if (this.#workout.length) {
      seeBtnClass.disabled = false;
      deleteAllWorkoutBtn.disabled = false;
      sortBtn.disabled = false;
    }
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    this.#map = L.map('map').setView([latitude, longitude], this.#mapZoomLevel);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    this.#workout.forEach(work => {
      this._renderWorkOutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // Empty inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    // Checking if input is Number
    const validInput = (...inputs) => inputs.every(inp => Number.isFinite(inp));
    e.preventDefault();
    if (containerWorkouts) {
      seeBtnClass.disabled = false;
      deleteAllWorkoutBtn.disabled = false;
      sortBtn.disabled = false;
    }
    // See all workout button activate
    // seeBtnClass.disabled = false;

    // Checking if input Number is positive
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // If workout running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // Check if data is valid
      if (
        // !Number.isFinite(distance) ||
        // !Number.isFinite(duration) ||
        // !Number.isFinite(cadence)
        !validInput(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert('input have to be positive numbers!');

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      // Check if data is valid
      if (
        !validInput(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return alert('input have to be positive numbers!');

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // Add new object to workout array
    this.#workout.push(workout);

    // Render workout on map as marker
    this._renderWorkOutMarker(workout);

    // Render workout on list
    this._renderWorkOut(workout);

    // Hide form and Clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();

    //
    // if (!this._renderWorkOut(workout))
    //   return seeBtnClass.classList.add('seebtn-hidden');
  }

  _renderWorkOutMarker(workout) {
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
  }

  _renderWorkOut(workout) {
    let html = `<li class="workout workout--${workout.type}" data-id="${
      workout.id
    }">
    <h2 class="workout__title">${workout.description}</h2>
    <div class="workout__details">
      <span class="workout__icon">${
        workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
      }</span>
      <span class="workout__value">${workout.distance}</span>
      <span class="workout__unit">km</span>
    </div>
    <div class="workout__details">
      <span class="workout__icon">⏱</span>
      <span class="workout__value">${workout.distance}</span>
      <span class="workout__unit">min</span>
    </div>`;

    if (workout.type === 'running')
      html += `
      <div class="workout__details">
        <span class="workout__icon">⚡️</span>
        <span class="workout__value">${workout.pace.toFixed(1)}</span>
        <span class="workout__unit">min/km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">🦶🏼</span>
        <span class="workout__value">${workout.cadence}</span>
        <span class="workout__unit">spm</span>
      </div>
    </li>`;

    if (workout.type === 'cycling')
      html += `
      <div class="workout__details">
        <span class="workout__icon">⚡️</span>
        <span class="workout__value">${workout.speed.toFixed(1)}</span>
        <span class="workout__unit">km/h</span>
      </div>
          <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevetionGain}</span>
          <span class="workout__unit">m</span>
        </div>
    </li>`;

    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    const workoutElement = e.target.closest('.workout');

    if (!workoutElement) return;

    const workout = this.#workout.find(
      work => work.id === workoutElement.dataset.id
    );
    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: { duration: 1 },
    });
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workout));
    localStorage.setItem('workoutsSort', JSON.stringify(this.#workout));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));
    const dataSort = JSON.parse(localStorage.getItem('workouts'));

    if (!data || !dataSort) return;

    this.#workout = data;

    this.#workout.forEach(work => {
      this._renderWorkOut(work);
    });
  }
  _seeAllWorkOut(e) {
    e.preventDefault();
    console.log(this.#workout);

    let zoomIndex = 6;

    // All workouts lat and lng
    const latArr = [];
    const lngArr = [];
    // Average lat and lng
    const latAndLng = [];

    // Getting data
    const allWorkout = this.#workout.forEach(work => {
      const [lat, lng] = work.coords;
      latArr.push(lat);
      lngArr.push(lng);
    });

    const latArrAverage = latArr.reduce((a, b) => a + b, 0) / latArr.length;
    const lngArrAverage = lngArr.reduce((a, b) => a + b, 0) / lngArr.length;

    latAndLng.push(latArrAverage);
    latAndLng.push(lngArrAverage);

    // MAX LAT AND LNG
    const maxLatArr = Math.max(...latArr);
    const maxLngArr = Math.max(...lngArr);
    const difMaxLatAverage = Math.abs(maxLatArr - latAndLng[0]);
    const difMaxLngAverage = Math.abs(maxLngArr - latAndLng[1]);

    // if difference lat
    if (difMaxLatAverage >= difMaxLngAverage) {
      if (difMaxLatAverage > latAndLng[0] * 1.1) {
        zoomIndex = +(difMaxLatAverage / 50).toFixed(0);
      }
    }
    // if difference lng
    if (difMaxLngAverage >= difMaxLatAverage) {
      if (difMaxLngAverage > latAndLng[1] * 1.1) {
        zoomIndex = +(difMaxLngAverage / 50).toFixed(0);
      }
    }

    this.#map.setView(latAndLng, zoomIndex, {
      animate: true,
      pan: { duration: 1 },
    });
  }
  reset() {
    // const workoutElement = e.target.closest('.workout');
    // if (!workoutElement) return;
    // const workouts = this.#workout.find(
    //   work => work.id === workoutElement.dataset.id
    // );
    // console.log(workouts);

    // alert('Are you sure to delet !');

    localStorage.removeItem(`workouts`);
    location.reload();
  }

  _deletWorkOut(e) {
    e.preventDefault();
    if (!containerWorkouts) return;

    // const workoutElement = e.target.closest('.workout');

    // if (!workoutElement) return;
    // const workout = this.#workout.find(
    //   work => work.id === workoutElement.dataset.id
    // );

    /*if (!this.#workout) return;
    const workout = this.#workout.find(
      work => work.id === this.#workout.dataset.id
    );*/

    // Confimation window
    if (confirm('Are you sure to delete them!')) {
      localStorage.removeItem(`workouts`);
      localStorage.removeItem(`workoutsSort`);
      location.reload();
    } else {
      console.log('you clicked no');
    }
  }

  // New sort btn
  _sortBtnByKM(e) {
    e.preventDefault();
    localStorage.removeItem(`workout`);

    const workoutSortByKM = this.#workout.sort(
      (a, b) => parseFloat(a.distance) - parseFloat(b.distance)
    );

    // console.log(workoutSortByKM);
    this.#workout = workoutSortByKM;

    this._renderWorkOut(this.#workout);
    this.#workout.forEach(work => {
      this._renderWorkOut(work);
      this._renderWorkOutMarker(work);
      this._renderWorkOutMarker(work);
    });

    this._setLocalStorage();

    this._getLocalStorage();
    console.log(this.#workout);
    console.log(this.#clicks);

    location.reload();

    ///////////////
    /* console.log(workoutSortByKM);
    localStorage.setItem('workoutsSort', JSON.stringify(workoutSortByKM));

    const data = JSON.parse(localStorage.getItem('workoutsSort'));
    if (!data) return;
    workoutSortByKM.forEach(work => {
      console.log(work);
      this._renderWorkOut(work);
      this._renderWorkOutMarker(work);
      this._renderWorkOutMarker(work);
    });*/
    ///////////////
  }
}

const app = new App();
