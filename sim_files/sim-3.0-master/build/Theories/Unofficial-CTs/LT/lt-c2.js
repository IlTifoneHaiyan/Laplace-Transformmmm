var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { global } from "../../../Sim/main.js";
import { add, createResult, l10, subtract, sleep, lfactorial } from "../../../Utils/helpers.js";
import Variable, { ExponentialCost } from "../../../Utils/variable.js";
import jsonData from "../../../Data/data.json" assert { type: "json" };
export default function ltc2(data) {
    return __awaiter(this, void 0, void 0, function* () {
        let sim = new ltSim(data);
        let res = yield sim.simulate();
        return res;
    });
}
class ltSim {
    constructor(data) {
        var _a;
        this.strat = data.strat;
        this.theory = "LT-c2";
        this.tauFactor = jsonData.theories["LT-main"]["tauFactor"];
        this.cap = typeof data.cap === "number" && data.cap > 0 ? [data.cap, 1] : [Infinity, 0];
        this.recovery = (_a = data.recovery) !== null && _a !== void 0 ? _a : { value: 0, time: 0, recoveryTime: false };
        this.lastPub = data.rho;
        this.sigma = data.sigma;
        this.curMult = 0;
        this.dt = global.dt;
        this.ddt = global.ddt;
        this.t = 0;
        this.ticks = 0;
        this.timer = 0;
        this.currencies = [0, 0];
        this.cycleTimes = [5, 1 * 60];
        this.maxRho = 0;
        this.t_var = 0;
        this.q = 0;
        this.laplaceActive = false;
        this.variables = [
            new Variable({
                cost: new ExponentialCost(1000, 1.8),
                value: 1,
                stepwisePowerSum: { default: true },
            }),
            new Variable({
                cost: new ExponentialCost(7500, 9),
                varBase: 2,
            }),
            new Variable({
                cost: new ExponentialCost(100, 22),
                stepwisePowerSum: { base: 1, length: 1 }
            }),
            new Variable({
                cost: new ExponentialCost(100, 2),
                stepwisePowerSum: { default: true },
            }),
            new Variable({
                cost: new ExponentialCost(1000, 11),
                varBase: 2,
            }),
            new Variable({
                cost: new ExponentialCost(100000, 100),
                varBase: 3,
            }),
        ];
        this.varNames = ["c1", "c2", "n", "c1s", "c2s", "lambda"];
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
        const conditions = { "LT-c2": new Array(this.variables.length).fill(true) };
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
        ];
    }
    simulate() {
        return __awaiter(this, void 0, void 0, function* () {
            let pubCondition = false;
            while (!pubCondition) {
                if (!global.simulating)
                    break;
                if ((this.ticks + 1) % 500000 === 0)
                    yield sleep();
                this.tick();
                if (this.currencies[0] > this.maxRho)
                    this.maxRho = this.currencies[0];
                this.buyVariables();
                pubCondition = this.maxRho >= 25;
                this.ticks++;
            }
            this.maxTauH = 69;
            this.pubT = this.t;
            this.pubRho = this.maxRho;
            const result = createResult(this, "");
            while (this.boughtVars[this.boughtVars.length - 1].timeStamp > this.pubT)
                this.boughtVars.pop();
            global.varBuy.push([result[7], this.boughtVars]);
            return result;
        });
    }
    transform() {
        this.laplaceActive = !this.laplaceActive;
        this.laplaceCounter++;
    }
    tick() {
        let cap = this.laplaceActive ? this.cycleTimes[1] : this.cycleTimes[0];
        if (this.timer >= cap) {
            this.timer = 0;
            this.transform();
        }
        let ldt = l10(this.dt);
        if (this.laplaceActive) {
            let lqs = lfactorial(this.variables[2].level + 1) - this.variables[5].value * (this.variables[2].level + 2);
            this.currencies[1] = add(this.currencies[1], this.variables[3].value + this.variables[4].value - lqs + ldt);
        }
        else {
            this.t_var = add(this.t_var, ldt);
            this.q = this.t_var * (this.variables[2].level + 1) + l10(Math.E) * (-1 * this.t_var * this.variables[5].value);
            this.currencies[0] = add(this.currencies[0], this.variables[0].value + this.variables[1].value + this.variables[5].value * 0.1 - this.q + ldt);
        }
        this.timer += this.dt / 1.5;
        this.t += this.dt / 1.5;
        this.dt *= this.ddt;
    }
    buyVariables() {
        const currencyIndices = [0, 0, 0, 1, 1, 1];
        for (let i = this.variables.length - 1; i >= 0; i--)
            while (true) {
                if (this.currencies[currencyIndices[i]] > this.variables[i].cost && this.conditions[i]() && this.milestoneConditions[i]()) {
                    this.currencies[currencyIndices[i]] = subtract(this.currencies[currencyIndices[i]], this.variables[i].cost);
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
                }
                else
                    break;
            }
    }
}
