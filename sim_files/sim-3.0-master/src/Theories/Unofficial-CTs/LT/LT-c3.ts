import { global, varBuy, theory } from "../../../Sim/main.js";
import { add, createResult, l10, subtract, theoryData, sleep, lfactorial } from "../../../Utils/helpers.js";
import Variable, { ExponentialCost } from "../../../Utils/variable.js";
import jsonData from "../../../Data/data.json" assert { type: "json" };

export default async function ltc3(data: theoryData) {
  let sim = new ltSim(data);
  let res = await sim.simulate();
  return res;
}

type strat = keyof (typeof jsonData.theories)["LT-c3"]["strats"];

class ltSim {
  conditions: Array<Function>;
  milestoneConditions: Array<Function>;

  strat: strat;
  theory: theory;
  tauFactor: number;
  //theory
  cap: Array<number>;
  recovery: { value: number; time: number; recoveryTime: boolean };
  lastPub: number;
  sigma: number;
  curMult: number;
  dt: number;
  ddt: number;
  t: number;
  ticks: number;
  timer: number;
  //currencies
  currencies: [number, number];
  maxRho: number;
  t_var: number;
  cycleTimes: Array<number>;
  laplaceActive: boolean;
  laplaceCounter: number;
  //initialize variables
  variables: Array<Variable>;
  boughtVars: Array<varBuy>;
  varNames: Array<string>;
  //pub values
  tauH: number;
  maxTauH: number;
  pubT: number;
  pubRho: number;
  //milestones  [dimensions, b1exp, b2exp, b3exp]
  milestones: Array<number>;
  pubMulti: number;
  q: number;
  tResetted: boolean;
  
  constructor(data: theoryData) {
    this.strat = data.strat as strat;
    this.theory = "LT-c3";
    this.tauFactor = jsonData.theories["LT-c3"]["tauFactor"];
    this.cap = typeof data.cap === "number" && data.cap > 0 ? [data.cap, 1] : [Infinity, 0];
    this.recovery = data.recovery ?? { value: 0, time: 0, recoveryTime: false };
    this.lastPub = data.rho;
    this.sigma = data.sigma;
    this.curMult = 0;
    this.dt = global.dt;
    this.ddt = global.ddt;
    this.t = l10(30);
    this.ticks = 0;
    this.timer = 0;
    this.currencies = [0, 0];
    this.cycleTimes = [30, 15 * 60];
    this.maxRho = 0;
    this.t_var = 0;
    this.q = 0;
    this.laplaceActive = false;
    this.tResetted = true;
    this.variables = [
      new Variable({
        cost: new ExponentialCost(3e1, 11),
        value: 1,
        varBase: 2,
      }),
      new Variable({
        cost: new ExponentialCost(4e3, 18),
        varBase: 3,
      }),
      new Variable({
        cost: new ExponentialCost(1e2, 3),
        varBase: 2 ** 0.1
      }),
      new Variable({
        cost: new ExponentialCost(50, 1.8),
        varBase: 2 ** 0.1,
      }),
      new Variable({
        cost: new ExponentialCost(11, 3),
        varBase: 3 ** 0.1,
      }),
      new Variable({
        cost: new ExponentialCost(100, 5.5),
        varBase: 2
      }),
      new Variable({
        cost: new ExponentialCost(1e2, 40),
      }),
      new Variable({
        cost: new ExponentialCost(1, 1)
      })
    ];
    this.varNames = ["c1", "c2", "c3", "c1s", "c2s", "c3s", "lambda", "t_reset"];
    this.boughtVars = [];
    this.tauH = 0;
    this.maxTauH = 0;
    this.pubT = 0;
    this.pubRho = 0;
    this.laplaceCounter = 0;
    this.pubMulti = 0;
    this.milestones = [0];
    this.conditions = this.getBuyingConditions();
    this.milestoneConditions = this.getMilestoneConditions();
  }
  getBuyingConditions() {
    const conditions: { [key in strat]: Array<boolean | Function> } = { 
      "LT-c3-AI": [
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        () => this.tResetted == false && this.laplaceActive == false,
      ] 
  };
    const condition = conditions[this.strat].map((v) => (typeof v === "function" ? v : () => v));
    return condition;
  }
  getMilestoneConditions() {
    return [
      () => this.laplaceActive == false,
      () => this.laplaceActive == false,
      () => this.laplaceActive == false,
      () => this.laplaceActive == true,
      () => this.laplaceActive == true,
      () => this.laplaceActive == true,
      () => this.laplaceActive == true,
      () => this.variables[7].level < 5
    ];
  }

  getLambda(){
    return l10(25 * 0.9 ** this.variables[6].level)
  }
  async simulate() {
    let pubCondition = false;
    while (!pubCondition) {
      if (!global.simulating) break;
      if ((this.ticks + 1) % 500000 === 0) await sleep();
      this.tick();
      if (this.currencies[0] > this.maxRho) this.maxRho = this.currencies[0];
      this.buyVariables();
      pubCondition = this.maxRho >= 25;
      this.ticks++;
    }
    this.maxTauH = 69;
    this.pubT = this.t;
    this.pubRho = this.maxRho;
    const result = createResult(this, "");
    while (this.boughtVars[this.boughtVars.length - 1].timeStamp > this.pubT) this.boughtVars.pop();
    global.varBuy.push([result[7], this.boughtVars]);
    return result;
  }
  transform() {
    this.timer = 0;
    this.laplaceActive = !this.laplaceActive;
    this.laplaceCounter++;
  }
  tick() {
    let cap = this.laplaceActive ? this.cycleTimes[1] : this.cycleTimes[0];
    if (this.timer >= cap) {
      this.transform();
    }
    let ldt = l10(this.dt);
    if (this.laplaceActive) {
      this.tResetted = false;
      let lqs = this.variables[5].value + this.variables[2].value + this.t_var + l10(Math.E) * (-1 * 10 ** (-1 * this.t_var) * (10 ** this.getLambda()))
      this.currencies[1] = add(this.currencies[1], this.variables[0].value + this.variables[1].value + this.variables[3].value + this.variables[4].value + lqs + ldt);
    } 
    else {
        if(this.t_var > this.getLambda()) {
          this.q = this.variables[2].value + this.variables[5].value;
          this.t_var = subtract(this.t_var, ldt);
        }
        else{
          this.q = -30000
        }
        this.currencies[0] = add(this.currencies[0], this.variables[0].value + this.variables[1].value + this.q + ldt);
    }
    this.timer += this.dt / 1.5;
    this.t += this.dt / 1.5;
    this.dt *= this.ddt;
  }
  buyVariables() {
    const currencyIndices = [0, 0, 0, 1, 1, 1, 1, 1];
    for (let i = this.variables.length - 1; i >= 0; i--)
      while (true) {
        if (this.currencies[currencyIndices[i]] > this.variables[i].cost && this.conditions[i]() && this.milestoneConditions[i]()) {
          this.currencies[currencyIndices[i]] = subtract(this.currencies[currencyIndices[i]], this.variables[i].cost);
          if (i == 7) {
            this.tResetted = true;
            this.t_var = l10(30);
        }
          if (this.maxRho + 25 > this.lastPub) {
            this.boughtVars.push({
              variable: this.varNames[i],
              level: this.variables[i].level + 1,
              cost: this.variables[i].cost,
              symbol: currencyIndices[i] === 0 ? "rho" : "lambda",
              timeStamp: this.t,
            });
          }
          this.variables[i].buy();
        } else break;
      }
  }
}
