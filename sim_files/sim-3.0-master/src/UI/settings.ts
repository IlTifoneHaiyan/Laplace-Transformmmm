import { qs, event } from "../Utils/helperFunctions.js";
import { decimals, round } from "../Utils/simHelpers.js";
import { getSimState, setSimState } from "./simState.js";

const settingsBtn = <HTMLButtonElement>qs(".settingsBtn");
const settingsCloseBtn = <HTMLButtonElement>qs(".settingsCloseBtn");
const settingsModal = <HTMLDialogElement>qs(".settings");

event(settingsBtn, "pointerdown", () => {
  settingsModal.showModal();
  document.body.style.overflow = "hidden";
});

event(settingsCloseBtn, "pointerdown", () => {
  settingsModal.close();
  document.body.style.overflow = "auto";
});

const dtSlider = <HTMLInputElement>qs(".dt");
const dtOtp = qs(".dtOtp");

const ddtSlider = <HTMLInputElement>qs(".ddt");
const ddtOtp = qs(".ddtOtp");

event(
  dtSlider,
  "input",
  () => (dtOtp.textContent = dtSlider.value === "0" ? "0.15" : dtSlider.value === "10" ? "5" : String(decimals(0.15 + 2 ** parseFloat(dtSlider.value) * (4.9 / (1 + 2 ** parseFloat(dtSlider.max))), 4)))
);

event(
  ddtSlider,
  "input",
  () => (ddtOtp.textContent = ddtSlider.value === "0" ? "1" : ddtSlider.value === "10" ? "1.3" : String(round(1 + Number(decimals(3 ** parseFloat(ddtSlider.value) * (0.3 / 3 ** parseFloat(ddtSlider.max)), 2)), 7)))
);

const setState = qs(".setState");
const getState = qs(".getState");

event(setState, "pointerdown", () => setSimState());
event(getState, "pointerdown", () => getSimState());

event(qs(".resetSettings"), "pointerdown", () => {
  dtSlider.value = "8.1943";
  dtOtp.textContent = "1.5";
  ddtSlider.value = "2.71233";
  ddtOtp.textContent = "1.0001";
});

// if(autoState)setTimeout(() => getSimState(), 500);
