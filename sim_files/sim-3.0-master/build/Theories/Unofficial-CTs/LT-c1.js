var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { global } from "../../Sim/main.js";
import { add, createResult, l10, subtract, ZERO } from "../../Utils/simHelpers.js";
import { findIndex, sleep } from "../../Utils/helperFunctions.js";
import Variable from "../../Utils/variable.js";
import { getTauFactor } from "../../Sim/Components/helpers.js";
export default function ltc1(data) {
    return __awaiter(this, void 0, void 0, function* () {
        let sim = new ltSim(data);
        let res = yield sim.simulate();
        return res;
    });
}
let binarySearch = (arr, target) =>
{
    let l = 0;
    let r = arr.length - 1;
    while(l < r)
    {
        let m = Math.ceil((l + r) / 2);
        if(arr[m] <= target)
            l = m;
        else
            r = m - 1;
    }
    return l;
}
class ltSim {
    constructor(data) {
        var _a;
        this.stratIndex = findIndex(data.strats, data.strat);
        this.strat = data.strat;
        this.theory = "LT-c1";
        this.tauFactor = getTauFactor(this.theory);
        this.cap = typeof data.cap === "number" && data.cap > 0 ? [data.cap, 1] : [Infinity, 0];
        this.recovery = (_a = data.recovery) !== null && _a !== void 0 ? _a : { value: 0, time: 0, recoveryTime: false };
        this.lastPub = data.rho;
        this.sigma = data.sigma;
        this.totMult = this.getTotMult(data.rho);
        this.curMult = 0;
        this.dt = global.dt;
        this.ddt = global.ddt;
        this.t = 0;
        this.ticks = 0;
        this.timer = 0;

        this.currencies = [0,0];
        this.cycleTimes = [[1 * 60, 5 * 60]];
        this.maxRho = 0;
        this.t_var = 0;
        this.laplaceActive = false;
        this.variables = [
            new Variable({
                cost: 10,
                costInc: 1.8,
                value: 1,
                stepwisePowerSum: {default: true}
            }),
            new Variable({
                cost: 750,
                costInc: 9,
                varBase: 2
            }),
            new Variable({
                cost: 10000,
                costInc: 22,
                varBase: 1.61
            }),
            new Variable({
                cost: 2000,
                costInc: 10,
                varBase: 2
            }),
            new Variable({
                cost: 500,
                costInc: 4,
                varBase: 1.5
            }),
            new Variable({
                cost: 10,
                costInc: 10,
                varBase: 3
            }),
        ];
        this.varNames = ['c1', 'c2', 'c3', 'c1s', 'c2s', 'lambda'];
        this.boughtVars = [];
        this.tauH = 0;
        this.maxTauH = 0;
        this.pubT = 0;
        this.pubRho = 0;
        this.laplaceCounter = 0;
        this.result = [];
        this.pubMulti = 0;
        this.milestones = [0]
        this.conditions = this.getBuyingConditions();
        console.log(this.conditions[this.stratIndex])
        this.milestoneConditions = this.getMilestoneConditions();
        this.milestoneTree = this.getMilestoneTree();
        this.updateMilestones();

        this.r = 0;
        this.i = 0;
    }
    getBuyingConditions() {
        let conditions = [
             new Array(this.variables.length).fill(true),
        ];
        conditions = conditions.map((elem) => elem.map((i) => (typeof i === "function" ? i : () => i)));
        console.log(conditions)
        return conditions;
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
    getMilestoneTree() {
        let tree = [
            ...new Array(3).fill([
                [0]
            ])
        ]

        return tree;
    }
    getTotMult(val) {
        return 0;
    }
    updateMilestones() {
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
                if(this.lastPub < 160)
                    this.updateMilestones();
                this.curMult = Math.pow(10, this.getTotMult(this.maxRho) - this.totMult);
                this.buyVariables();
                pubCondition = this.maxRho >= 20;
                this.ticks++;
            }
            this.pubMulti = Math.pow(10, this.getTotMult(this.pubRho) - this.totMult);
            this.maxTauH = 69;
            this.pubT = this.t;
            this.pubRho = this.maxRho;
            this.result = createResult(this, "");
            while(this.boughtVars[this.boughtVars.length - 1].timeStamp > this.pubT)
                this.boughtVars.pop();
            console.log(this.currencies)
            global.varBuy.push([this.result[7], this.boughtVars]);
            return this.result;
        });
    }
    transform() {
        this.laplaceActive = !this.laplaceActive;
        this.laplaceCounter++;
    }
    tick() {
        let cap = this.laplaceActive ? this.cycleTimes[this.stratIndex][1] : this.cycleTimes[this.stratIndex][0];
        if(this.timer >= cap)
        {
            this.timer = 0;
            this.transform();
        }
        let ldt = l10(this.dt);
        let bonus = 0; //this.totMult;
        if(this.laplaceActive) {
            let  rq = this.variables[3].value + l10(0.5);
            let iq = this.variables[4].value - l10(Math.abs(1.1 - this.variables[4].level % 2 == 0 ? 0.94 : 1.21));
            this.r = add(this.r, rq + ldt);
            this.i = add(this.i, iq + ldt);
            this.currencies[1] = add(this.currencies[1], this.variables[2].value + this.r + this.i + ldt)
        }
        else { 
            this.currencies[0] = add(this.currencies[0], bonus + this.variables[0].value + this.variables[1].value + this.variables[5].value);
        }
        this.timer += this.dt / 1.5;
        this.t += this.dt / 1.5;
        this.dt *= this.ddt;
    }
    buyVariables() {
        const currencyIndices = [0, 0, 0, 1, 1, 1];
        for (let i = this.variables.length - 1; i >= 0; i--)
            while (true) {
                if (this.currencies[currencyIndices[i]] > this.variables[i].cost && this.conditions[this.stratIndex][i]() && this.milestoneConditions[i]()) {
                    this.currencies[currencyIndices[i]] = subtract(this.currencies[currencyIndices[i]], this.variables[i].cost);
                    if(this.maxRho + 5 > this.lastPub)
                    {
                        this.boughtVars.push({
                            variable: this.varNames[i],
                            level: this.variables[i].lvl + 1,
                            cost: this.variables[i].cost,
                            timeStamp: this.t
                        });
                    }
                    this.variables[i].buy();
                }
                else
                    break;
            }
    }
}