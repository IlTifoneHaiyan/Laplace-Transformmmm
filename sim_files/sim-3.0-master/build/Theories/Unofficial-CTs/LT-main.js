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
export default function lt(data) {
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
        this.theory = "LT-main";
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
        this.cycleTimes = [[30*60, 30*60] , [2*60, 2*60], [2*60, 240*60]];
        this.maxRho = 0;
        this.t_var = 0;
        this.s = l10((1 + 5 ** 0.5) / 2 - 1);
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
                cost: 100,
                costInc: 15,
                varBase: 2
            }),
            new Variable({
                firstFreeCost: true,
                cost: 4e2,
                costInc: 15,
                stepwisePowerSum: {default: true}
                // 0.05 multiplier can't go here
            }),
            new Variable({
                cost: 1e4,
                costInc: 24,
                varBase: Math.E
                // 0.5 power can't go here
            }),
            new Variable({
                firstFreeCost: true,
                cost: 1e5,
                costInc: 3,
                stepwisePowerSum: {default: true}
            }),
            new Variable({
                cost: 1e7,
                costInc: 5e4,
                varBase: 5,
            }),
            new Variable({
                cost: 1e50,
                costInc: 1e40,
            })
        ];
        this.varNames = ['c1', 'c2', 'c3', 't_dot', 'c_s1', 'c_s2', 'lambda_s', 'lambda_exp'];
        this.boughtVars = [];
        this.tauH = 0;
        this.maxTauH = 0;
        this.pubT = 0;
        this.pubRho = 0;
        this.laplaceCounter = 0;
        //qt qs challenges
        this.milestones = [0, 0, 0, 0];
        this.result = [];
        this.pubMulti = 0;
        this.conditions = this.getBuyingConditions();
        this.milestoneConditions = this.getMilestoneConditions();
        this.milestoneTree = this.getMilestoneTree();
        this.updateMilestones();
    }
    getBuyingConditions() {
        let conditions = [
            Array(this.variables.length).fill(true),
            [
                () => this.variables[0].cost + l10(5 + 0.5 * (this.variables[0].lvl % 10) + 0.0001) < Math.min(this.variables[1].cost, this.variables[2].cost),
                true,
                true,
                () => this.variables[3].cost + 1 + l10(5 + 0.5 * (this.variables[3].lvl % 10) + 0.0001) < Math.min(this.variables[1].cost, this.variables[2].cost),
                true,
                true,
                true,
                true
            ],
            Array(this.variables.length).fill(true),
        ];
        conditions = conditions.map((elem) => elem.map((i) => (typeof i === "function" ? i : () => i)));
        return conditions;
    }
    getMilestoneConditions() {
        return [
            () => this.laplaceActive == false,
            () => this.laplaceActive == false,
            () => this.laplaceActive == false,
            () => this.laplaceActive == false,
            () => this.laplaceActive == true,
            () => this.laplaceActive == true,
            () => this.laplaceActive == true && this.variables[6].lvl < 40,
            () => this.laplaceActive == true,
        ];
    }
    getMilestoneTree() {
        let tree = [
            ...new Array(3).fill([
                [0, 0, 0, 0],
                [0, 0, 1, 0],
                [0, 0, 2, 0],
                [1, 0, 2, 0],
                [2, 0, 2, 0],
                [3, 0, 2, 0],
                [3, 1, 2, 0],
                [3, 2, 2, 0],
                [3, 3, 2, 0],
                [3, 4, 2, 0],
                [3, 4, 2, 1],
            ])
        ]

        return tree;
    }
    getTotMult(val) {
        return Math.max(0, val * this.tauFactor * 10 - l10(2));
    }
    updateMilestones() {
        const points = [0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200];
        let stage = binarySearch(points, Math.max(this.lastPub, this.maxRho));
        const max = [3, 4, 2, 1];
        const tPriority = [1, 2, 3, 4];
        const sPriority = [3, 2, 1, 4];
        if (this.stratIndex == 1){
            let priority;
            let milestoneCount = stage;
            if(this.laplaceActive)
                priority = sPriority;
            else
                priority = tPriority;

            this.milestones = [0, 0, 0, 0];
            for (let i = 0; i < priority.length; i++) {
                while (this.milestones[priority[i] - 1] < max[priority[i] - 1] && milestoneCount > 0) {
                    this.milestones[priority[i] - 1]++;
                    milestoneCount--;
                }
            }
        }
        else {
            this.milestones = this.milestoneTree[this.stratIndex][Math.min(this.milestoneTree[this.stratIndex].length - 1, stage)];
        }

        console.log((this.milestones[2]))
        if (this.variables[6].varBase !== 10 * (10 ** this.milestones[2])) {
            this.variables[6].varBase = 10 * (10 ** this.milestones[2]);
            this.variables[6].reCalculate();
        }
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
                pubCondition = !this.laplaceActive && this.laplaceCounter > 0 && (global.forcedPubTime !== Infinity ? this.t > global.forcedPubTime : this.t > this.pubT * 2 || this.pubRho > this.cap[0]) && this.pubRho > 7;
                this.ticks++;
            }
            this.pubMulti = Math.pow(10, this.getTotMult(this.pubRho) - this.totMult);
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
    getQS() { return this.variables[5].value * 2 + this.variables[4].value / 2 + this.s + add(this.s, 0); }
    tick() {
        let cap = this.laplaceActive ? this.cycleTimes[this.stratIndex][1] : this.cycleTimes[this.stratIndex][0];
        if(this.maxRho > 4 && this.timer >= cap)
        {
            this.timer = 0;
            this.transform();
        }
        let ldt = l10(this.dt);
        let bonus = this.totMult;
        if(this.laplaceActive) {
            if(this.variables[5].lvl > 0)
            {
                this.s = add(this.s, this.t_var);
                this.t_var = ZERO;
                this.currencies[1] = add(this.currencies[1], bonus * (0.1 + 0.1 * this.milestones[1]) + this.getQS() + ldt);
1            }
        }
        else {
            this.t_var = add(this.t_var, this.variables[3].value + l10(0.05) + ldt);
            let q = this.variables[2].value;
            if(this.t_var < 2)
                q += l10(1 - Math.exp(-Math.pow(10, this.t_var)));
            this.currencies[0] = add(this.currencies[0], bonus + this.variables[0].value * (1 + 0.05 * this.milestones[0]) + this.variables[1].value + this.variables[6].value * (1 + 0.1 * this.variables[7].lvl) + q + ldt);
        }
        this.timer += this.dt / 1.5;
        this.t += this.dt / 1.5;
        this.dt *= this.ddt;
        if (this.maxRho < this.recovery.value)
            this.recovery.time = this.t;
        this.tauH = (this.maxRho - this.lastPub) / (this.t / 3600);
        this.effectiveTauH = (this.maxRho - this.lastPub) / (this.effectiveT / 3600);
        if (this.maxTauH < this.tauH || this.maxRho >= this.cap[0] - this.cap[1] || this.pubRho < this.lastPub || this.pubRho < 7 || global.forcedPubTime !== Infinity) {
            this.maxTauH = this.tauH;
            this.pubT = this.t;
            this.pubRho = this.maxRho;
        }
    }
    buyVariables() {
        const currencyIndices = [0, 0, 0, 0, 1, 1, 1, 1];
        for (let i = this.variables.length - 1; i >= 0; i--)
            while (true) {
                if (this.currencies[currencyIndices[i]] > this.variables[i].cost && this.conditions[this.stratIndex][i]() && this.milestoneConditions[i]()) {
                    this.currencies[currencyIndices[i]] = subtract(this.currencies[currencyIndices[i]], this.variables[i].cost);
                    if(this.maxRho + 5 > this.lastPub)
                    {
                        this.boughtVars.push({
                            variable: this.laplaceActive,
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