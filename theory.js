import { ExponentialCost, FirstFreeCost, FreeCost, LinearCost } from "../api/Costs";
import { Localization } from "../api/Localization";
import { parseBigNumber, BigNumber } from "../api/BigNumber";
import { theory } from "../api/Theory";
import { Utils } from "../api/Utils";
import { log } from "../../../Downloads/TheorySDK.Win.1.4.29/api/Utils";

var id = "LT";
var name = "Laplace Transforms";
var tauExponent = 0.06;
const basePubExp = 0.15
var description = "A custom theory based on Laplace transforms.";
var authors = "Gaunter#1337";
var version = "1.6";
var currency;
var laplaceActive = false;
var activeSystemId = 0;
var systems = []
var timer = 0;
var c1Exponent, piExponent, challengeUnlock, laplaceTransformUnlock, lambdaBase;
var tDomainTime = 1;
var sDomainTime = 1;
var automationEnabled = false;
var isChallengeCleared = [0, 0, 0, 0, 0, 0, 0]


// UI Sliders
var tDomainSlider = ui.createSlider({
    value: tDomainTime,
    onValueChanged: () => {
        tDomainTime = Math.round(tDomainSlider.value)
    }
}); 
var sDomainSlider = ui.createSlider({
    value: sDomainTime,
    onValueChanged: () => {
        sDomainTime = Math.round(sDomainSlider.value)
    }
});

tDomainSlider.maximum = 60;
tDomainSlider.minimum = 1;
sDomainSlider.maximum = 60;
sDomainSlider.minimum = 1;

var autoLaplaceToggle = ui.createSwitch({
    onToggled: () => {
        automationEnabled = !automationEnabled;
        timer = 0;
    }
});

var init = () => {
    currency = theory.createCurrency();
    laplaceCurrency = theory.createCurrency("Λ", "\\Lambda");

    getCustomCost = (total) => 20 * (total + 1) * tauExponent;
    
    /////////////////////
    // Permanent Upgrades
    theory.createPublicationUpgrade(1, currency, 1e7);
    theory.createBuyAllUpgrade(2, currency, 1e10);
    theory.createAutoBuyerUpgrade(3, currency, 1e15);

    {
        laplaceTransformUnlock = theory.createPermanentUpgrade(4, currency, new LinearCost(1e4, 0));
        laplaceTransformUnlock.maxLevel = 1;
        laplaceTransformUnlock.getDescription = (_) => Localization.getUpgradeUnlockDesc("\\text{Laplace transformation}");
        laplaceTransformUnlock.getInfo = (_) => Utils.getMath("\\mathcal{L}\\{q_t\\} = \\int_{0}^{\\infty}q_te^{-st}dt");
    }

    theory.setMilestoneCost(new CustomCost(total => BigNumber.from(getCustomCost(total))));
    ////////////// ///////
    // Milestone Upgrades
    {
        c1Exponent = theory.createMilestoneUpgrade(0, 3);
        c1Exponent.getDescription = (_) => Localization.getUpgradeIncCustomExpDesc("c_1", 0.05);
        c1Exponent.getInfo = (_) => Localization.getUpgradeIncCustomExpInfo("c_1", "0.05");
        c1Exponent.boughtOrRefunded = (_) => { theory.invalidatePrimaryEquation(); };
    }
    {
        piExponent = theory.createMilestoneUpgrade(1, 4);
        piExponent.getDescription = (_) => Localization.getUpgradeIncCustomExpDesc("Π", "0.1");
        piExponent.getInfo = (_) => Localization.getUpgradeIncCustomExpInfo("Π", "0.1");
        piExponent.boughtOrRefunded = (_) => { theory.invalidatePrimaryEquation(); };
    }
    {
        lambdaBase = theory.createMilestoneUpgrade(2, 2);
        lambdaBase.getDescription = (_) => "Multiply λ base by 10";
        lambdaBase.getInfo = (_) => "Multiply λ base by 10";
        lambdaBase.boughtOrRefunded = (_) => { theory.invalidatePrimaryEquation(); };
    }
    {
        challengeUnlock = theory.createMilestoneUpgrade(3, 1);
        challengeUnlock.getDescription = (_) => ("Unlock assignments");
        challengeUnlock.getInfo = (_) => ("Unlock assignments");
        challengeUnlock.canBeRefunded = () => false;
    }

    // Takes an upgrade within each system and converts it into a purchasable theory upgrade
    var upgradeFactory = (systemId, upgrade, system) => {
        let temp = theory.createUpgrade(100 * systemId + upgrade.internalId, upgrade.laplaceUpgrade == true ?  laplaceCurrency : currency , upgrade.costModel);
        temp.getDescription = upgrade.description;
        temp.getInfo = upgrade.info;
        // Any new upgrades defined this way will be set to false by default and will be available only when the system is active
        temp.isAvailable = false;
        if (upgrade.maxLevel) temp.maxLevel = upgrade.maxLevel;
        if(!upgrade.refundable) temp.canBeRefunded = (_) => false;
        // ensures purchases subtract from system currency also
        temp.bought = (amount) => {
            if(temp.level - amount >= 0 && upgrade.laplaceUpgrade == false){
                if(!upgrade.isSuperExponentialCost) {
                    system.currency -= upgrade.costModel.getSum(temp.level - amount, temp.level).min(system.currency);
                }
                else{
                    // Because the cost scaling is so sharp, assume the cumulative cost equals the cost of the highest level purchased
                    system.currency -= upgrade.costModel.getCost(temp.level - 1).min(system.currency);
                }
            }
            else if(temp.level - amount >= 0 && upgrade.laplaceUpgrade == true){
                if(!upgrade.isSuperExponentialCost) {
                    system.laplaceCurrency -= upgrade.costModel.getSum(temp.level - amount, temp.level).min(system.laplaceCurrency);
                }
                else{
                    system.laplaceCurrency -= upgrade.costModel.getCost(temp.level - 1).min(system.laplaceCurrency);
                }
            }
        }

        temp.refunded = (amount) => {
            if(amount - temp.level >= 0 && upgrade.laplaceUpgrade == false){
                if(!upgrade.isSuperExponentialCost) {
                    system.currency += upgrade.costModel.getSum(temp.level, amount - temp.level);
                }
                else{
                    // Because the cost scaling is so sharp, assume the cumulative cost equals the cost of the highest level purchased
                    system.currency += upgrade.costModel.getCost(temp.level);
                }
            }
            else if(amount - temp.level >= 0 && upgrade.laplaceUpgrade == true){
                log(amount - temp.level)
                log(temp.level)
                if(!upgrade.isSuperExponentialCost) {
                    system.laplaceCurrency += upgrade.costModel.getSum(temp.level, amount - temp.level);
                }
                else{
                    system.laplaceCurrency += upgrade.costModel.getCost(temp.level);
                }
            }
        }
        
        return temp;
    }

    // Defines the super exponential cost model
    class SuperExponentialCost{
        constructor(initialCost, firstIncrease, increment) {
            this.initialCost = initialCost;
            this.firstIncrease = firstIncrease;
            this.increment = increment;
        }

        getCostFunction(){
            return (level) => {
                return BigNumber.from(this.initialCost) * BigNumber.TEN.pow(level / 2 * (
                    2 * BigNumber.from(this.firstIncrease).log10() + (level - 1) * BigNumber.from(this.increment).log10()
                ))
            }
        }

        parseCustomCost(){
            return new CustomCost(this.getCostFunction())
        }
    }
    // Defines systems used within the theory including main equation and challenges
    // Abstract Class
    class System {
        systemId;
        upgrades = [];
        currency = BigNumber.ZERO;
        laplaceCurrency = BigNumber.ZERO;

        tick = (elapsedTime, multiplier) => { return };

        getInternalState() {
            return JSON.stringify({
                currency: BigNumber.toString(this.currency),
                laplaceCurrency: BigNumber.toString(this.laplaceCurrency)
            })
        }

        setInternalState(state) {
            let values = JSON.parse(state)
            this.currency = BigNumber.from(values.currency)
            this.laplaceCurrency = BigNumber.from(values.currency)
        }

        primaryEquation() {
            return ""
        }

        secondaryEquation() {
            return ""
        }

        tertiaryEquation() {
            return ""
        }

        getSystemId() {
            return this.systemId;
        }

        getCurrency() {
            return this.currency;
        }
        processPublish() {
            return;
        }
    }
    class ChallengeOne extends System{
        constructor(){
            super();
            this.systemId = 1;
            this.name = "Trigonometry";
            this.t = 0;
            this.isUnlocked = false;
            this.R = BigNumber.ZERO,
            this.I = BigNumber.ZERO,
            this.realS = BigNumber.ONE;
            this.imagS = BigNumber.ZERO;
            this.denominator = BigNumber.ONE;
            this.currency = BigNumber.ZERO;
            this.laplaceCurrency = BigNumber.ZERO;
            this.maxRho = BigNumber.TEN.pow(0);
            this.goal = BigNumber.from(1e20);
            this.isPaused = false;
            this.valueOfTText = () => Utils.getMath("t = " + this.t.toPrecision(3) + "\\pi")
            this.tSlider = ui.createSlider({
                minimum: 0,
                maximum: 64,
                value: 0,
                onValueChanged: () => {
                    this.t = Math.floor(this.tSlider.value) / 32;
                    Utils.getMath("t = " + this.t.toPrecision(3) + "\\pi");
                }
            });
            this.pauseSwitch = ui.createSwitch({
                isToggled: this.isPaused,
                onToggled: () => this.isPaused = !this.isPaused
            })
            this.menu = this.createTSliderMenu()

            this.c1 = {
                internalId: 1,
                description: (_) => Utils.getMath("c_1 =" + this.getC1(this.c1.upgrade.level)),
                info: (amount) => Utils.getMathTo("c_1 =" + this.getC1(this.c1.upgrade.level), "c_1=" + this.getC1(this.c1.upgrade.level + amount)),
                costModel: new ExponentialCost(10, Math.log2(1.8)),
                laplaceUpgrade: false,
            }

            this.c2 = {
                internalId: 2,
                description: (_) => Utils.getMath("c_{2} = 2^{" + this.c2.upgrade.level + "}"),
                info: (amount) => Utils.getMathTo("c_2 =" + this.getC2(this.c2.upgrade.level), "c_{2}=" + this.getC2(this.c2.upgrade.level + amount)),
                costModel: new ExponentialCost(750, Math.log2(9)),
                laplaceUpgrade: false
            }
            this.c3 = {
                internalId: 3,
                description: (_) => Utils.getMath("c_{3} = \\phi^{" + this.c3.upgrade.level + "}"),
                info: (amount) => Utils.getMathTo("c_3 =" + this.getC3(this.c3.upgrade.level), "c_{3}=" + this.getC3(this.c3.upgrade.level + amount)),
                costModel: new ExponentialCost(10000, Math.log2(22)),
                laplaceUpgrade: false
            }
            this.c1s = {
                internalId: 4,
                description: (_) => Utils.getMath("c_{1s} = 2^{" + this.c1s.upgrade.level + "}"),
                info: (amount) => Utils.getMathTo("c_{1s} =" + this.getC1S(this.c1s.upgrade.level), "c_{1s}=" + this.getC1S(this.c1s.upgrade.level + amount)),
                costModel: new ExponentialCost(2000, Math.log2(10)),
                laplaceUpgrade: true
            }

            this.c2s = {
                internalId: 5,
                description: (_) => Utils.getMath("c_{2s} = (-1.5)^{" + this.c2s.upgrade.level + "}"),
                info: (amount) => Utils.getMathTo("c_{2s} =" + this.getC2S(this.c2s.upgrade.level), "c_{2s}=" + this.getC2S(this.c2s.upgrade.level + amount)),
                costModel: new ExponentialCost(500, Math.log2(4)),
                laplaceUpgrade: true    
            }

            this.lambda = {
                internalId: 6,
                description: (_) => Utils.getMath("\\lambda = (-3)^{" + this.lambda.upgrade.level + "}"),
                info: (amount) => Utils.getMathTo("\\lambda = " + this.getLambda(this.c2s.upgrade.level), 
                "\\lambda = " + this.getLambda(this.c2s.upgrade.level + amount)),
                costModel: new ExponentialCost(10, Math.log2(10)),
                laplaceUpgrade: true    
            }

            this.upgrades = [this.c1, this.c2, this.c3, this.c1s, this.c2s, this.lambda];
            for (var upgrade of this.upgrades) {
                let temp = upgradeFactory(this.systemId, upgrade, this);
                // this creates a 'pointer' to the real upgrade within the object instance
                upgrade.upgrade = temp;
            }
        }

        unlock(){
            if(systems[0].laplaceCurrency >= BigNumber.from(1e40)){
                this.isUnlocked = true;
            }
            else{
                let menu = ui.createPopup({
                    title: "Unlock Condition",
                    content: ui.createStackLayout({
                        children: [
                            ui.createLatexLabel({
                                text: Utils.getMath("\\Lambda > 1e40")
                            }),
                        ]
                    })
                });
                    menu.show();
            }
        }

        isCleared(){
            return this.maxRho >= this.goal;
        }

        getC1(level) { return Utils.getStepwisePowerSum(level, 2, 10, 1); }
        getC2(level) { return BigNumber.TWO.pow(level); }
        getC3(level) { return BigNumber.from(1.618033988749894).pow(level); }
        getC1S(level) { return BigNumber.TWO.pow(level); }
        getC2S(level) { return (-1) ** level * BigNumber.from(1.5).pow(level); }
        getLambda(level) { return (-1) ** level * BigNumber.from(3).pow(level); }
        getRQs() { return this.denominator != BigNumber.ZERO? this.denominator.pow(-1) * (1 + this.realS) : BigNumber.ZERO}
        getIQs() { return this.denominator != BigNumber.ZERO? this.denominator.pow(-1) * (-1 * this.imagS) : BigNumber.ZERO}
        tick(elapsedTime, _) {
            let dt = elapsedTime;
            if (laplaceActive && !this.isPaused){
                this.realS = parseFloat(Math.cos(2 * Math.PI * this.t).toFixed(3));
                this.imagS = parseFloat(Math.sin(2 * Math.PI * this.t).toFixed(3));
                this.denominator = BigNumber.from((1 + this.realS) ** 2 + this.imagS ** 2);
                this.R += this.getC1S(this.c1s.upgrade.level) * (1 - this.getRQs()) * dt;
                this.I += this.getC2S(this.c2s.upgrade.level) / (1.1 - this.getIQs()) * dt;
                this.laplaceCurrency += this.R * this.I * this.getC3(this.c3.upgrade.level) * dt;
            }
            else if (!this.isPaused){
                this.currency += this.getC1(this.c1.upgrade.level) * this.getC2(this.c2.upgrade.level) 
                * this.getLambda(this.lambda.upgrade.level) * BigNumber.from(Math.sin(Math.PI * this.t)) * dt
            }
            // else do nothing
            if (this.currency > this.maxRho){
                this.maxRho = this.currency
            }
        }

        viewReward(){
            let menu = ui.createPopup({
                title: "Reward",
                content: ui.createStackLayout({
                    children: [
                        ui.createLatexLabel({
                            text: Utils.getMath("\\text{Unlock Laplace Transform automation options. \\\\ Additionally, each challenge completion \\\\ increases \\lambda \\ base by 100.}")
                        })
                    ]
                })
            })
            menu.show();
        }

        createTSliderMenu() {
            let menu = ui.createPopup({
                title: "Value of t Adjustment",
                content: ui.createStackLayout({
                    children: [
                        ui.createLatexLabel({
                            text: this.valueOfTText
                        }),
                        this.tSlider,
                        ui.createLabel({
                            text: "Pause Challenge"
                        }),
                        this.pauseSwitch
                    ]
                })
            });

            return menu;
        }

        primaryEquation() {
            theory.primaryEquationHeight = 82;
            let result = "\\begin{matrix}";
            if (!laplaceActive) {
                result += "\\dot{\\rho} = c_{1} c_{2} \\lambda q_t \\\\";
                result += "q_t = \\sin(\\pi t) \\\\";
            }
            else {
                result += "\\dot{\\Lambda} = c_3RI";
                result += "\\\\ \\dot{R} = c_{1s}(1 - \\operatorname{Re}(q_s)), \\ \\dot{I} = \\frac{c_{2s}}{1.1 - \\operatorname{Im}(q_s)} \\\\";
                result += "\\\\ q_s = \\frac{1}{s^2 + 1}";
            }
            result += "\\end{matrix}"
            return result;
        }

        secondaryEquation() {
            theory.secondaryEquationHeight = 75;
            theory.secondaryEquationScale = 1.4;
            if (laplaceActive) {
                // Equation while under Laplace transform
                let result = "\\begin{matrix}"
                result += "s = e^{i\\pi t}";
                result += "\\\\ \\operatorname{Re}(q_s) = " + this.getRQs() + ", \\ \\operatorname{Im}(q_s) = " + this.getIQs()
                result += "\\end{matrix}"
                return result
            }
            else {
                // Default case
                let result = "\\begin{matrix}"
                result += "\\sin(\\pi t) = " + BigNumber.from(Math.sin(Math.PI * this.t))
                result += "\\\\ \\max \\rho = " + this.maxRho.toString()
                result += "\\end{matrix}"
                return result;
            }
        }

        tertiaryEquation() {
            let result = "t = " + this.t.toString();
            if(laplaceActive){
                result += ", \\ R = " + this.R + ", \\ I = " + this.I
            }
            return result;
        }

        getInternalState() {
            return JSON.stringify({
                t: `${this.t}`,
                R: `${this.R}`,
                I: `${this.I}`,
                isPaused: `${this.isPaused}`,
                isUnlocked: `${this.isUnlocked}`,
                currency: `${this.currency}`,
                laplaceCurrency: `${this.laplaceCurrency}`,
                maxRho: `${this.maxRho}`
            })
        }

        setInternalState(state) {
            let values = JSON.parse(state);
            if(values.t) { this.t = parseFloat(values.t); this.tSlider.value = this.t; }
            if(values.R) this.R = parseBigNumber(values.R);
            if(values.I) this.I = parseBigNumber(values.I);
            if(values.isPaused) { this.isPaused = values.isPaused == "true"; this.pauseSwitch.isToggled = values.isPaused == "true"; }
            if(values.isUnlocked) { this.isUnlocked = values.isUnlocked == "true"; }
            if(values.currency) this.currency = parseBigNumber(values.currency);
            if(values.laplaceCurrency) this.laplaceCurrency = parseBigNumber(values.laplaceCurrency);
            if(values.maxRho) this.maxRho = parseBigNumber(values.maxRho);
        }

        processPublish(){
            resetUpgrades(this.upgrades);
            this.t = 0;
            this.tSlider.value = this.t;
            this.currency = BigNumber.ZERO;
            this.laplaceCurrency = BigNumber.ZERO;
            this.R = BigNumber.ZERO;
            this.I = BigNumber.ZERO;
        }
    }

    class ChallengeTwo extends System{
        constructor(){
            super();
            this.systemId = 2;
            this.name = "Time Conundrum";
            this.t = BigNumber.FIVE;
            this.q = BigNumber.ZERO;
            this.isUnlocked = false;
            this.currency = BigNumber.ZERO;
            this.laplaceCurrency = BigNumber.ZERO;
            this.maxRho = BigNumber.TEN.pow(0);
            this.goal = BigNumber.from(1e25);

            this.c1 = {
                internalId: 1,
                description: (_) => Utils.getMath("c_1 =" + this.getC1(this.c1.upgrade.level)),
                info: (amount) => Utils.getMathTo("c_1 =" + this.getC1(this.c1.upgrade.level), "c_1=" + this.getC1(this.c1.upgrade.level + amount)),
                costModel: new ExponentialCost(1e1, Math.log2(1.8)),
                laplaceUpgrade: false,
            }

            this.c2 = {
                internalId: 2,
                description: (_) => Utils.getMath("c_{2} = 2^{" + this.c2.upgrade.level + "}"),
                info: (amount) => Utils.getMathTo("c_2 =" + this.getC2(this.c2.upgrade.level), "c_{2}=" + this.getC2(this.c2.upgrade.level + amount)),
                costModel: new ExponentialCost(1e2, Math.log2(12)),
                laplaceUpgrade: false
            }
            this.n = {
                internalId: 3,
                description: (_) => Utils.getMath("n = " + this.getN(this.n.upgrade.level)),
                info: (amount) => Utils.getMathTo("n =" + this.getN(this.n.upgrade.level), " n =" + this.getN(this.n.upgrade.level + amount)),
                costModel: new ExponentialCost(1e3, Math.log2(5e2)),
                maxLevel: 4,
                laplaceUpgrade: false
            }
            this.c1s = {
                internalId: 4,
                description: (_) => Utils.getMath("c_{1s} =" + this.getC1S(this.c1s.upgrade.level)),
                info: (amount) => Utils.getMathTo("c_{1s} =" + this.getC1S(this.c1s.upgrade.level), "c_{1s}=" + this.getC1S(this.c1s.upgrade.level + amount)),
                costModel: new ExponentialCost(50, Math.log2(1.8)),
                laplaceUpgrade: true
            }

            this.c2s = {
                internalId: 5,
                description: (_) => Utils.getMath("c_{2s} = 2^{" + this.c2s.upgrade.level + "}"),
                info: (amount) => Utils.getMathTo("c_{2s} =" + this.getC2S(this.c2s.upgrade.level), "c_{2s}=" + this.getC2S(this.c2s.upgrade.level + amount)),
                costModel: new FirstFreeCost(new ExponentialCost(11, Math.log2(11))),
                laplaceUpgrade: true    
            }

            this.lambda = {
                internalId: 6,
                description: (_) => Utils.getMath("\\lambda = 0.7^{" + this.lambda.upgrade.level + "}"),
                info: (amount) => Utils.getMathTo("\\lambda = " + this.getLambda(this.lambda.upgrade.level), 
                "\\lambda = " + this.getLambda(this.lambda.upgrade.level + amount)),
                costModel: new ExponentialCost(1e2, Math.log2(1e3)),
                maxLevel: 10,
                laplaceUpgrade: true    
            }

            this.timeMachine = {
                internalId: 7,
                description: (_) => Utils.getMath("\\text{???}"),
                info: (_) => Utils.getMath("\\text{???}"),
                maxLevel: 1,
                costModel: new ExponentialCost(1e7, 1),
                laplaceUpgrade: true
            }

            this.upgrades = [this.c1, this.c2, this.n, this.c1s, this.c2s, this.lambda, this.timeMachine];
            for (var upgrade of this.upgrades) {
                let temp = upgradeFactory(this.systemId, upgrade, this);
                // this creates a 'pointer' to the real upgrade within the object instance
                upgrade.upgrade = temp;
            }
        }
        
        getC1(level) { return Utils.getStepwisePowerSum(level, 2, 10, 1); }
        getC2(level) { return BigNumber.TWO.pow(level); }
        getN(level) { return 2 * level + 1; }
        getNFactorial(value) { return (2 * BigNumber.PI * value).pow(0.5) * (BigNumber.from(value) / BigNumber.E).pow(value) * (
            // Stirling series to approximate factorial
              1 + 1 / (12 * value) + 1 / (288 * value ** 2) - 139 / (51840 * value ** 3) - 571 / (2488320 * value ** 4) )};

        getC1S(level) { return Utils.getStepwisePowerSum(level, 2, 10, 1); }
        getC2S(level) { return BigNumber.TWO.pow(level); }
        getLambda(level) { return BigNumber.from(0.7).pow(level); }
        getQS() { return this.getNFactorial(this.getN(this.n.upgrade.level)) / (this.getLambda(this.lambda.upgrade.level).pow
        (this.getN(this.n.upgrade.level) + 1)) }

        tick(elapsedTime, _) {
            let dt = elapsedTime;
            if (laplaceActive){
                if (this.timeMachine.upgrade.level > 0) this.t = (this.t - dt).max(-100);
                this.laplaceCurrency += this.getC1S(this.c1s.upgrade.level) * this.getC2S(this.c2s.upgrade.level) * this.getQS() * dt;
            }
            else{
                this.t = (this.t + dt).min(3600);
                this.q = (this.t.sign) ** (this.getN(this.n.upgrade.level)) 
                * this.t.abs().pow(this.getN(this.n.upgrade.level)) * 
                BigNumber.E.pow(this.getLambda(this.lambda.upgrade.level) * this.t);
                this.currency += this.getC1(this.c1.upgrade.level) * this.getC2(this.c2.upgrade.level) * (1 - this.q) * dt
            }

            if (this.currency > this.maxRho){
                this.maxRho = this.currency
            }
        }

        unlock(){
            if(systems[0].t >= BigNumber.from(1e20)){
                this.isUnlocked = true;
            }
            else{
                let menu = ui.createPopup({
                    title: "Unlock Condition",
                    content: ui.createStackLayout({
                        children: [
                            ui.createLatexLabel({
                                text: Utils.getMath("t > 1e20")
                            }),
                        ]
                    })
                });
                    menu.show();
            }
        }

        isCleared(){
            return this.maxRho >= this.goal;
        }

        primaryEquation() {
            theory.primaryEquationHeight = 82;
            let result = "\\begin{matrix}";
            if (!laplaceActive) {
                result += "\\dot{\\rho} = c_{1} c_{2} (1 - q_t) \\\\";
                result += "q_t = t^n e^{\\lambda t} \\\\";
            }
            else {
                result += "\\dot{\\Lambda} = \\ c_{1s} c_{2s}q_s";
                result += "\\\\ q_s = \\frac{n!}{(s - \\lambda)^{(n+1)}}";
            }
            result += "\\end{matrix}"
            return result;
        }

        secondaryEquation() {
            theory.secondaryEquationHeight = 100;
            theory.secondaryEquationScale = 1.4;
            if (laplaceActive) {
                // Equation while under Laplace transform
                let result = "\\begin{matrix}"
                result += "s = 2 \\lambda";
                if (this.timeMachine.upgrade.level > 0) result += "\\\\ \\dot{t} = -1"
                result += "\\end{matrix}"
                return result
            }
            else {
                // Default case
                let result = "\\begin{matrix}"
                result += "\\\\ \\max \\rho = " + this.maxRho.toString()
                result += "\\end{matrix}"
                return result;
            }
        }

        tertiaryEquation() {
            let result = "t = " + this.t.toString();
            if(laplaceActive){
                result += ", \\ q_s = " + this.getQS().toString();
            }
            else{
                result += ", \\ q_t = " + this.q.toString();
            }
            return result;
        }
        viewReward(){
            let menu = ui.createPopup({
                title: "Reward",
                content: ui.createStackLayout({
                    children: [
                        ui.createLatexLabel({
                            text: Utils.getMath("\\text{Add an exponent to }\\dot{t}")
                        })
                    ]
                })
            })
            menu.show();
        }

        getInternalState() {
            return JSON.stringify({
                t: `${this.t}`,
                q: `${this.q}`,
                isUnlocked: `${this.isUnlocked}`,
                currency: `${this.currency}`,
                laplaceCurrency: `${this.laplaceCurrency}`,
                maxRho: `${this.maxRho}`
            })
        }

        setInternalState(state) {
            let values = JSON.parse(state);
            if(values.t) { this.t = parseBigNumber(values.t); }
            if(values.q) { this.q = parseBigNumber(values.q); }
            if(values.isUnlocked) { this.isUnlocked = values.isUnlocked == "true"; }
            if(values.currency) this.currency = parseBigNumber(values.currency);
            if(values.laplaceCurrency) this.laplaceCurrency = parseBigNumber(values.laplaceCurrency);
            if(values.maxRho) this.maxRho = parseBigNumber(values.maxRho);
        }

        processPublish(){
            resetUpgrades(this.upgrades);
            this.t = BigNumber.ZERO;
            this.currency = BigNumber.ZERO;
            this.laplaceCurrency = BigNumber.ZERO;
        }
    }

    class ChallengeThree extends System{
        constructor(){
            super();
            this.systemId = 3;
            this.name = "Differential Equations";
            this.t = 0;
            this.q = BigNumber.ZERO;
            this.isUnlocked = false;
            this.currency = BigNumber.ZERO;
            this.laplaceCurrency = BigNumber.ZERO;
            this.maxRho = BigNumber.TEN.pow(0);
            this.goal = BigNumber.from(1e20);

            this.omegaT = {
                internalId: 1,
                description: (_) => Utils.getMath("\\omega_{t} = 6^{" + this.omegaT.upgrade.level + "}"),
                info: (amount) => Utils.getMathTo("\\omega_t =" + this.getOmegaT(this.omegaT.upgrade.level), "\\omega_{t}=" + this.getOmegaT(this.omegaT.upgrade.level + amount)),
                costModel: new ExponentialCost(1e1, Math.log2(10)),
                laplaceUpgrade: false,
            }

            this.omegaS = {
                internalId: 2,
                description: (_) => Utils.getMath("\\omega_{s} =" + this.getOmegaS(this.omegaS.upgrade.level)),
                info: (amount) => Utils.getMathTo("\\omega_s =" + this.getOmegaS(this.omegaS.upgrade.level), "\\omega_{s}=" + this.getOmegaS(this.omegaS.upgrade.level + amount)),
                costModel: new ExponentialCost(1e1, Math.log2(10)),
                laplaceUpgrade: true,
            }
            this.c = {
                internalId: 3,
                description: (_) => Utils.getMath("c = e^" + (this.c.upgrade.level + 1)),
                info: (amount) => Utils.getMathTo("c = " + this.getC(this.c.upgrade.level), "c = " + this.getC(this.c.upgrade.level + amount)),
                costModel: new ExponentialCost(1e5, Math.log2(1e4)),
                laplaceUpgrade: false
            }
            this.c1s = {
                internalId: 4,
                description: (_) => Utils.getMath("c_{1s} =" + this.getC1S(this.c1s.upgrade.level)),
                info: (_) => Utils.getMath("c_{1s} =" + this.getC1S(this.c1s.upgrade.level)),
                costModel: new ExponentialCost(1000, Math.log2(1.2)),
                laplaceUpgrade: true,
                refundable: true,
            }

            this.c2s = {
                internalId: 5,
                description: (_) => Utils.getMath("c_{2s} = " + this.getC2S(this.c2s.upgrade.level)),
                info: (_) => Utils.getMath("c_{2s} = " + this.getC2S(this.c2s.upgrade.level)),
                costModel: new ExponentialCost(1e6, Math.log2(1.5)),
                laplaceUpgrade: true,
                refundable: true
            }

            this.resetT = theory.createSingularUpgrade(this.systemId * 100 + 8, laplaceCurrency,
                new ExponentialCost(1e6, Math.log2(1e6)))
            {
                this.resetT.description = Utils.getMath("t \\leftarrow 0");
                this.resetT.info = Utils.getMath("t \\leftarrow 0");
                this.resetT.bought = (_) => {
                    this.laplaceCurrency -= this.resetT.cost.getCost(
                        this.resetT.level - 1
                    )
                     this.t = 0;
                     this.q = BigNumber.ZERO;
                }

            }
            this.resetC1SandC2S = theory.createSingularUpgrade(this.systemId * 100 + 9, currency, new FreeCost())
            {
                this.resetC1SandC2S.description = Utils.getMath("\\text{Reset c_{1s} and c_{2s}}");
                this.resetC1SandC2S.info = Utils.getMath("\\text{Reset c_{1s} and c_{2s}}");
                this.resetC1SandC2S.boughtOrRefunded = (_) => {
                     this.c1s.upgrade.refund(this.c1s.upgrade.level);
                     this.c2s.upgrade.refund(this.c2s.upgrade.level);
                }

            }

            this.upgrades = [this.omegaT, this.omegaS, this.c, this.c1s, this.c2s];
            for (var upgrade of this.upgrades) {
                let temp = upgradeFactory(this.systemId, upgrade, this);
                // this creates a 'pointer' to the real upgrade within the object instance
                upgrade.upgrade = temp;
            }
        }
        
        getOmegaT(level) { return BigNumber.from(6).pow(level); }
        getOmegaS(level) { return BigNumber.SEVEN.pow(0.1 * level); }
        getC(level) { return BigNumber.E.pow(level + 1); }
        getC1S(level) { return BigNumber.from(level) + 1; }
        getC2S(level) { return BigNumber.from(level) + 1; }
        getS() { return this.t > 0? BigNumber.from(1 / this.t) : BigNumber.TEN.pow(308); }
        getQS() { 
            let s = this.getS();
            return this.calculateFactor() * s.pow(-2);
        }   
        calculateFactor() { return (this.getC(this.c.upgrade.level) - this.getLambda()).abs().pow(2); }
        getLambda() { return this.getC1S(this.c1s.upgrade.level) / this.getC2S(this.c2s.upgrade.level); }

        tick(elapsedTime, _) {
            let dt = elapsedTime;
            if (laplaceActive){
               this.laplaceCurrency += this.getOmegaT(this.omegaT.upgrade.level) * this.getOmegaS(this.omegaS.upgrade.level) * this.getQS() * dt;
            }
            else{
                this.t += dt;
                this.q += this.calculateFactor() * dt;
                this.currency += this.getOmegaT(this.omegaT.upgrade.level) * this.getOmegaS(this.omegaS.upgrade.level) * BigNumber.PI.pow(-1 * this.q) * dt
            }

            if (this.currency > this.maxRho){
                this.maxRho = this.currency
            }
        }

        unlock(){
            if(systems[0].currency >= BigNumber.TEN.pow(1000)){
                this.isUnlocked = true;
            }
            else{
                let menu = ui.createPopup({
                    title: "Unlock Condition",
                    content: ui.createStackLayout({
                        children: [
                            ui.createLatexLabel({
                                text: Utils.getMath("\\rho > 1e1000")
                            }),
                        ]
                    })
                });
                    menu.show();
            }
        }

        isCleared(){
            return this.maxRho >= this.goal;
        }

        primaryEquation() {
            theory.primaryEquationHeight = 82;
            let result = "\\begin{matrix}";
            if (!laplaceActive) {
                result += "\\dot{\\rho} = \\omega_{t} \\omega_{s} c \\pi^{-q_t} \\\\";
                result += "\\dot{q_t} = (c - \\lambda)^2";
            }
            else {
                result += "\\dot{\\Lambda} = \\omega_{t} \\omega_{s} q_s";
                result += "\\\\ s q_s = \\frac{(c - \\lambda)^2}{s}";
            }
            result += "\\end{matrix}"
            return result;
        }

        secondaryEquation() {
            theory.secondaryEquationHeight = 100;
            theory.secondaryEquationScale = 1.4;
            if (laplaceActive) {
                // Equation while under Laplace transform
                let result = "\\begin{matrix}"
                result += "s = \\frac{1}{t}"
                result += "\\ \\lambda = \\frac{c_{1s}}{c_{2s}}"
                result += "\\end{matrix}"
                return result
            }
            else {
                // Default case
                let result = "\\begin{matrix}"
                result += "\\\\ \\max \\rho = " + this.maxRho.toString()
                result += "\\end{matrix}"
                return result;
            }
        }

        tertiaryEquation() {
            let result = "t = " + this.t.toFixed(2);
            if(laplaceActive){
                result += ", \\ s = " + this.getS().toString() + ", \\ q_s = " + this.getQS().toString() + ", \\ (c - \\lambda)^2 = " + this.calculateFactor().toNumber().toFixed(8);
            }
            else{
                result += ", \\ q_t = " + this.q.toString();
            }
            return result;
        }
        viewReward(){
            let menu = ui.createPopup({
                title: "Reward",
                content: ui.createStackLayout({
                    children: [
                        ui.createLatexLabel({
                            text: Utils.getMath("\\text{Unlock the terms: \\Omega, \\omega_t, \\omega_s}"),
                        })
                    ]
                })
            })
            menu.show();
        }

        getInternalState() {
            return JSON.stringify({
                t: `${this.t}`,
                q: `${this.q}`,
                isUnlocked: `${this.isUnlocked}`,
                currency: `${this.currency}`,
                laplaceCurrency: `${this.laplaceCurrency}`,
                maxRho: `${this.maxRho}`
            })
        }

        setInternalState(state) {
            let values = JSON.parse(state);
            if(values.t) { this.t = parseFloat(values.t); }
            if(values.q) { this.q = parseBigNumber(values.q); }
            if(values.isUnlocked) { this.isUnlocked = values.isUnlocked == "true"; }
            if(values.currency) this.currency = parseBigNumber(values.currency);
            if(values.laplaceCurrency) this.laplaceCurrency = parseBigNumber(values.laplaceCurrency);
            if(values.maxRho) this.maxRho = parseBigNumber(values.maxRho);
        }

        processPublish(){
            resetUpgrades(this.upgrades);
            this.resetT.level = 0;
            this.resetC1SandC2S.level = 0;
            this.t = 0;
            this.q = BigNumber.ZERO;
            this.currency = BigNumber.ZERO;
            this.laplaceCurrency = BigNumber.ZERO;
        }
    }

    class ChallengeFour extends System{
        constructor(){
            super();
            this.systemId = 4;
            this.name = "Unit Step Functions";
            this.t = 30;
            this.q = BigNumber.ZERO;
            this.isUnlocked = false;
            this.currency = BigNumber.ZERO;
            this.laplaceCurrency = BigNumber.ZERO;
            this.maxRho = BigNumber.TEN.pow(0);
            this.goal = BigNumber.from(1e30);

            this.c1 = {
                internalId: 1,
                description: (_) => Utils.getMath("c_{1} = 2^{" + this.c1.upgrade.level + "}"),
                info: (amount) => Utils.getMathTo("c_1 =" + this.getC1(this.c1.upgrade.level), "c_{2}=" + this.getC1(this.c1.upgrade.level + amount)),
                costModel: new SuperExponentialCost(3e1, 8, 1.25).parseCustomCost(),
                laplaceUpgrade: false,
                isSuperExponentialCost: true,
            }

            this.c2 = {
                internalId: 2,
                description: (_) => Utils.getMath("c_{2} = 3^{" + this.c2.upgrade.level + "}"),
                info: (amount) => Utils.getMathTo("c_2 =" + this.getC2(this.c2.upgrade.level), "c_{2}=" + this.getC2(this.c2.upgrade.level + amount)),
                costModel: new SuperExponentialCost(100, 12, 1.25).parseCustomCost(),
                laplaceUpgrade: false,
                isSuperExponentialCost: true
            }
            this.c3 = {
                internalId: 3,
                description: (_) => Utils.getMath("c_3 = " + this.getC3(this.c3.upgrade.level) + "c_{3s}"),
                info: (amount) => Utils.getMath("c_3 =" + this.getC3(this.c3.upgrade.level) * this.getC3S(this.c3s.upgrade.level)),
                costModel: new ExponentialCost(50, Math.log2(1.8)),
                laplaceUpgrade: false
            }
            this.c1s = {
                internalId: 4,
                description: (_) => Utils.getMath("c_{1s} =" + this.getC1S(this.c1s.upgrade.level) + "c_1"),
                info: (amount) => Utils.getMath("c_{1s} =" + this.getC1S(this.c1s.upgrade.level) * this.getC1(this.c1.upgrade.level)),
                costModel: new ExponentialCost(50, Math.log2(1.8)),
                laplaceUpgrade: true
            }

            this.c2s = {
                internalId: 5,
                description: (_) => Utils.getMath("c_{2s} = " + this.getC2S(this.c2s.upgrade.level) + "c_2"),
                info: (amount) => Utils.getMath("c_{2s} = " + this.getC2S(this.c2s.upgrade.level) * this.getC2(this.c2.upgrade.level)),
                costModel: new FirstFreeCost(new ExponentialCost(11, Math.log2(3))),
                laplaceUpgrade: true    
            }

            this.c3s = {
                internalId: 6,
                description: (_) => Utils.getMath("c_{3s} = 2^{" + this.c3s.upgrade.level + "}"),
                info: (amount) => Utils.getMathTo("c_{3s} = " + this.getC3S(this.c3s.upgrade.level), 
                "c_{3s} = " + this.getC3S(this.c3s.upgrade.level + amount)),
                costModel: new ExponentialCost(100, Math.log2(6.25)),
                laplaceUpgrade: true    
            }

            this.lambda = {
                internalId: 7,
                description: (_) => Utils.getMath("\\lambda = " + this.getLambda(this.lambda.upgrade.level).toFixed(2)),
                info: (amount) => Utils.getMathTo("\\lambda = " + this.getLambda(this.lambda.upgrade.level).toFixed(2), "\\lambda = " + this.getLambda(this.lambda.upgrade.level + amount).toFixed(2)),
                costModel: new ExponentialCost(1e2, Math.log2(40)),
                laplaceUpgrade: true
            }

            this.resetT = theory.createSingularUpgrade(this.systemId * 100 + 8, currency, new FreeCost())
            {
                this.resetT.description = Utils.getMath("t \\leftarrow 30");
                this.resetT.info = Utils.getMath("t \\leftarrow 30");
                this.resetT.maxLevel = 4;
                this.resetT.boughtOrRefunded = (_) => this.t = 30;

            }
            this.upgrades = [this.c1, this.c2, this.c3, this.c1s, this.c2s, this.c3s, this.lambda];
            for (var upgrade of this.upgrades) {
                let temp = upgradeFactory(this.systemId, upgrade, this);
                // this creates a 'pointer' to the real upgrade within the object instance
                upgrade.upgrade = temp;
            }
        }
        
        getC1(level) { return BigNumber.TWO.pow(level); }
        getC2(level) { return BigNumber.THREE.pow(level); }
        getC3(level) { return BigNumber.TWO.pow(level * 0.1); }
        getC1S(level) { return BigNumber.TWO.pow(level * 0.1); }
        getC2S(level) { return BigNumber.THREE.pow(level * 0.1); }
        getC3S(level) { return BigNumber.TWO.pow(level); }
        getQS() {
            let s = BigNumber.from(1/this.t)
            return this.getC3S(this.c3s.upgrade.level) / s * BigNumber.E.pow(-1 * this.getLambda(this.lambda.upgrade.level) * s)
        }   
        getLambda(level) { return 25 * 0.9 ** level; }

        tick(elapsedTime, _) {
            let dt = elapsedTime;
            if (laplaceActive){
               this.laplaceCurrency += this.getC1(this.c1.upgrade.level) * this.getC2(this.c2.upgrade.level) * 
               this.getC1S(this.c1s.upgrade.level) * this.getC2S(this.c2s.upgrade.level) * this.getQS() * dt;
            }
            else{
                this.t -= dt;
                this.t = Math.max(this.t, this.getLambda(this.lambda.upgrade.level));
                this.q = (this.t > this.getLambda(this.lambda.upgrade.level))? this.getC3S(this.c3s.upgrade.level) * this.getC3(this.c3.upgrade.level) : BigNumber.ZERO; 
                BigNumber.E.pow(this.getLambda(this.c3s.upgrade.level) * this.t);
                this.currency += this.getC1(this.c1.upgrade.level) * this.getC2(this.c2.upgrade.level) * (this.q) * dt
            }

            if (this.currency > this.maxRho){
                this.maxRho = this.currency
            }
        }

        unlock(){
            if(systems[0].currency >= BigNumber.TEN.pow(2100)){
                this.isUnlocked = true;
            }
            else{
                let menu = ui.createPopup({
                    title: "Unlock Condition",
                    content: ui.createStackLayout({
                        children: [
                            ui.createLatexLabel({
                                text: Utils.getMath("\\rho > 1e2100")
                            }),
                        ]
                    })
                });
                    menu.show();
            }
        }

        isCleared(){
            return this.maxRho >= this.goal;
        }

        primaryEquation() {
            theory.primaryEquationHeight = 82;
            let result = "\\begin{matrix}";
            if (!laplaceActive) {
                result += "\\dot{\\rho} = c_{1} c_{2} q_t \\\\";
                result += "q_t = u_t(t-\\lambda)c_3 \\\\";
            }
            else {
                result += "\\dot{\\Lambda} = \\ c_{1s} c_{2s}q_s";
                result += "\\\\ q_s = \\frac{c_{3s}}{s}e^{-\\lambda s}";
            }
            result += "\\end{matrix}"
            return result;
        }

        secondaryEquation() {
            theory.secondaryEquationHeight = 100;
            theory.secondaryEquationScale = 1.4;
            if (laplaceActive) {
                // Equation while under Laplace transform
                let result = "\\begin{matrix}"
                result += "s = \\frac{1}{t}"
                result += "\\end{matrix}"
                return result
            }
            else {
                // Default case
                let result = "\\begin{matrix}"
                result += "\\\\ \\max \\rho = " + this.maxRho.toString()
                result += "\\end{matrix}"
                return result;
            }
        }

        tertiaryEquation() {
            let result = "t = " + this.t.toFixed(2);
            if(laplaceActive){
                result += ", \\ q_s = " + this.getQS().toString();
            }
            else{
                result += ", \\ q_t = " + this.q.toString();
            }
            return result;
        }
        viewReward(){
            let menu = ui.createPopup({
                title: "Reward",
                content: ui.createStackLayout({
                    children: [
                        ui.createLatexLabel({
                            text: Utils.getMath("\\begin{matrix} \
                            \\\\ \\text{Increases \\Omega \\ exponent (t domain only).} \
                            \\\\ \\Omega \\rightarrow \\Omega ^{1 + \\frac{\\log_{10}{(1+t)}}{375}} \
                            \\end{matrix}"),
                            fontSize: 16
                        })
                    ]
                })
            })
            menu.show();
        }

        getInternalState() {
            return JSON.stringify({
                t: `${this.t}`,
                q: `${this.q}`,
                isUnlocked: `${this.isUnlocked}`,
                currency: `${this.currency}`,
                laplaceCurrency: `${this.laplaceCurrency}`,
                maxRho: `${this.maxRho}`
            })
        }

        setInternalState(state) {
            let values = JSON.parse(state);
            if(values.t) { this.t = parseFloat(values.t); }
            if(values.q) { this.q = parseBigNumber(values.q); }
            if(values.isUnlocked) { this.isUnlocked = values.isUnlocked == "true"; }
            if(values.currency) this.currency = parseBigNumber(values.currency);
            if(values.laplaceCurrency) this.laplaceCurrency = parseBigNumber(values.laplaceCurrency);
            if(values.maxRho) this.maxRho = parseBigNumber(values.maxRho);
        }

        processPublish(){
            resetUpgrades(this.upgrades);
            this.resetT.level = 0;
            this.t = 30;
            this.currency = BigNumber.ZERO;
            this.laplaceCurrency = BigNumber.ZERO;
        }
    }

    class MainSystem extends System {
        constructor() {
            super();
            this.systemId = 0;
            this.s = BigNumber.from((1 + 5 ** 0.5) / 2 - 1);
            this.t = BigNumber.ZERO;
            this.currency = BigNumber.ZERO;
            this.laplaceCurrency = BigNumber.ZERO;
            this.c1 = {
                internalId: 4,
                description: (_) => Utils.getMath("c_1=" + this.getC1(this.c1.upgrade.level)),
                info: (amount) => Utils.getMathTo("c_1=" + this.getC1(this.c1.upgrade.level), "c_1=" + this.getC1(this.c1.upgrade.level + amount)),
                costModel: new ExponentialCost(10, Math.log2(1.8)),
                laplaceUpgrade: false,
            }

            this.c2 = {
                internalId: 2,
                description: (_) => Utils.getMath("c_{2}= 2^{" + this.c2.upgrade.level + "}"),
                info: (amount) => Utils.getMathTo("c_2=" + this.getC2(this.c2.upgrade.level), "c_{2}=" + this.getC2(this.c2.upgrade.level + amount)),
                costModel: new ExponentialCost(750, Math.log2(9)),
                laplaceUpgrade: false
            }

            this.c3 = {
                internalId: 3,
                description: (_) => Utils.getMath("c_3 = 2^{" + this.c3.upgrade.level + "}"),
                info: (amount) => Utils.getMathTo("c_3 = " + this.getC3(this.c3.upgrade.level).toString(), "c_3 = " + this.getC3(this.c3.upgrade.level + amount).toString()),
                costModel: new ExponentialCost(100, Math.log2(15)),
                laplaceUpgrade: false
            }

            this.tdot = {
                internalId: 1,
                description: (_) => Utils.getMath("\\dot{t} "+ this.getTDotExponentText() +" =" + this.getTDot(this.tdot.upgrade.level)),
                info: (amount) => Utils.getMathTo("\\dot{t} "+ this.getTDotExponentText() +" = " + this.getTDot(this.tdot.upgrade.level), "\\dot{t}"+ this.getTDotExponentText() +"=" + this.getTDot(this.tdot.upgrade.level + amount)),
                costModel: new FirstFreeCost(new ExponentialCost(4e2, Math.log2(15))),
                laplaceUpgrade: false,
                maxLevel: 600
            }

            this.c1s = {
                internalId: 5,
                description: (_) => Utils.getMath("c_{1s} = e^{" + 0.5 * this.c1s.upgrade.level + "}"),
                info: (amount) => Utils.getMathTo("c_{1s} = " + this.getC1S(this.c1s.upgrade.level), "c_{1s} = " + this.getC1S(this.c1s.upgrade.level + amount)),
                costModel: new ExponentialCost(1e4, Math.log2(24)),
                laplaceUpgrade: true,
            }

            this.c2s = {
                internalId: 6,
                description: (_) => Utils.getMath("c_{2s} = " + this.getC2S(this.c2s.upgrade.level)),
                info: (amount) => Utils.getMathTo("c_{2s} = " + this.getC2S(this.c2s.upgrade.level), "c_{2s} = " + this.getC2S(this.c2s.upgrade.level + amount)),
                costModel: new FirstFreeCost(new ExponentialCost(1e5, Math.log2(3))),
                laplaceUpgrade: true
            }

            this.lambda = {
                internalId: 7,
                description: (_) => Utils.getMath("\\lambda = " + this.calculateLambdaBase() + "^{" + (this.lambda.upgrade.level)+ "}"),
                info: (amount) => Utils.getMathTo("\\lambda = " + this.getLambda(this.lambda.upgrade.level), "\\lambda_{s} = " + this.getLambda(this.lambda.upgrade.level + amount)),
                costModel: new CompositeCost(36, new ExponentialCost(1e5, Math.log2(1e5)), new SuperExponentialCost(1e185, 1e5, 30).parseCustomCost()),
                isSuperExponentialCost: true,
                laplaceUpgrade: true,
            }
            this.lambdaExponent = {
                internalId: 8,
                description: (_) => Localization.getUpgradeIncCustomExpDesc("λ", "0.05"),
                info: (_) => Localization.getUpgradeIncCustomExpInfo("λ", "0.05"),
                costModel: new SuperExponentialCost(1e25, 1e10, 1e4).parseCustomCost(),
                isSuperExponentialCost: true,
                laplaceUpgrade: true,
            }
            this.tDotExponent = {
                internalId: 9,
                description: (_) => Localization.getUpgradeIncCustomExpDesc("\\dot{t}", 0.01),
                info: (_) => Localization.getUpgradeIncCustomExpInfo("\\dot{t}", 0.01),
                costModel: new ExponentialCost(BigNumber.TEN.pow(900), Math.log2(1e5)),
                laplaceUpgrade: false,
                isAvailable: false
            }
            this.omegaT = {
                internalId: 10,
                description: (_) => Utils.getMath("\\omega_t = " + this.getOmegaT(this.omegaT.upgrade.level)),
                info: (amount) => Utils.getMathTo("\\omega_t = " + this.getOmegaT(this.omegaT.upgrade.level),
                "\\omega_t = " + this.getOmegaT(this.omegaT.upgrade.level + amount)),
                costModel: new ExponentialCost(BigNumber.TEN.pow(1400), Math.log2(16)),
                laplaceUpgrade: false,
            }
            this.omegaS = {
                internalId: 11,
                description: (_) => Utils.getMath("\\omega_s = 2^{" + this.omegaS.upgrade.level + "}"),
                info: (amount) => Utils.getMathTo("\\omega_s = " + this.getOmegaS(this.omegaS.upgrade.level),
                "\\omega_s = " + this.getOmegaS(this.omegaS.upgrade.level + amount)),
                costModel: new ExponentialCost(BigNumber.TEN.pow(210), Math.log2(1e4)),
                laplaceUpgrade: true,
            }

            this.upgrades = [this.tdot, this.c1, this.c2, this.c3, this.c1s, this.c2s, this.lambda, this.lambdaExponent, this.tDotExponent, this.omegaT, this.omegaS];
            for (var upgrade of this.upgrades) {
                let temp = upgradeFactory(this.systemId, upgrade, this);
                // this creates a 'pointer' to the real upgrade within the object instance
                upgrade.upgrade = temp;
            }
        }

        getC1(level) { return Utils.getStepwisePowerSum(level, 2, 10, 1); }
        getC2(level) { return BigNumber.TWO.pow(level); }
        getC3(level) { return BigNumber.TWO.pow(level); }
        getTDot(level) { return 0.05 * Utils.getStepwisePowerSum(level, 2, 10, 0).pow(1 + this.tDotExponent.upgrade.level * 0.01); }
        getTDotExponentText(){
            let level = this.tDotExponent.upgrade.level;
            if(level > 0){
                return "^{" + (1 + 0.01 * level).toFixed(2)+"}"
            }
            else{
                return "";
            }
        }
        getC1S(level) { return BigNumber.E.pow(level * 0.5); }
        getC2S(level) { return Utils.getStepwisePowerSum(level, 2, 10, 0); }
        calculateLambdaBase() { 
            let sum = 0;
            if(isChallengeCleared[0]) {
                for(var i = 0; i < isChallengeCleared.length; i++){
                    sum += isChallengeCleared[i]
                }
            }

            return 6 * 10 ** (lambdaBase.level) + 100 * sum;
        }
        getLambda(level) { return BigNumber.from(this.calculateLambdaBase()).pow(level);}
        getQS() { return (this.getC2S(this.c2s.upgrade.level).pow(2) * this.getC1S(this.c1s.upgrade.level) * this.s * (this.s + 1)); }
        getOmegaT(level) { return BigNumber.from(2).pow(0.1 * level); }
        getOmegaS(level) { return BigNumber.from(2).pow(level); }
        getOmega() { return (this.getOmegaT(this.omegaT.upgrade.level) * this.getOmegaS(this.omegaS.upgrade.level)); }
        tick(elapsedTime, multiplier) {
            let dt = BigNumber.from(elapsedTime * multiplier);
            let bonus = theory.publicationMultiplier;
            if(automationEnabled){
                timer += elapsedTime;
                if(laplaceActive && timer / 60 >= sDomainTime){
                    laplaceActive = false;
                    timer = 0;
                }
                else if(!laplaceActive && timer / 60 >= tDomainTime){
                    laplaceActive = true;
                    timer = 0;
                }
            }
        
            if (laplaceActive) {
                this.s += this.t * (1 - BigNumber.E.pow(-dt));
                this.t = this.t * BigNumber.E.pow(-dt);
                this.laplaceCurrency += bonus.pow(0.1 + piExponent.level * 0.1) * this.getOmega()
                * this.getQS() * dt;
            }
            else {
                this.t += this.getTDot(this.tdot.upgrade.level) * dt;
                this.q = this.getC3(this.c3.upgrade.level) * (1 - BigNumber.E.pow(-1 * this.t));
                this.currency += bonus * this.getOmega().pow(1 + isChallengeCleared[3] * (1 + this.t).log10() / 450)
                * this.getLambda(this.lambda.upgrade.level).pow(1 + this.lambdaExponent.upgrade.level * 0.05) * this.getC1(this.c1.upgrade.level).pow(1 + c1Exponent.level * 0.05) * this.getC2(this.c2.upgrade.level) * this.q * dt;
            }
        }

        getInternalState() {
            return JSON.stringify({
                s: `${this.s}`,
                t: `${this.t}`,
                q: `${this.q}`,
                currency: `${this.currency}`,
                laplaceCurrency: `${this.laplaceCurrency}`
            })
        }

        setInternalState(state) {
            let values = JSON.parse(state);
            if(values.s) this.s = parseBigNumber(values.s);
            if(values.t) this.t = parseBigNumber(values.t);
            if(values.q) this.q = parseBigNumber(values.q)
            if(values.currency) this.currency = parseBigNumber(values.currency);
            if(values.laplaceCurrency) this.laplaceCurrency = parseBigNumber(values.laplaceCurrency);
        }

        primaryEquation() {
            theory.primaryEquationHeight = 75;
            let c1ExponentText = (c1Exponent.level > 0) ? "^{" + (1 + c1Exponent.level * 0.05).toString() + "}" : "";
            let lambdaExponentText = (this.lambda.upgrade.level > 0) ? "^{" + (1 + this.lambdaExponent.upgrade.level * 0.05).toFixed(2) + "}" : "";
            let omegaExponentText = isChallengeCleared[3] == 1? "^{" + (1 + isChallengeCleared[3] * (1 + this.t).log10() / 450).toNumber().toFixed(2) + "}" : "";
            let piExponentText = (0.1 + piExponent.level * 0.1).toFixed(1)
            let result = "\\begin{matrix}";
            if (!laplaceActive) {
                result += "\\dot{\\rho} = c_{1} "  + c1ExponentText + " c_{2} " + (laplaceTransformUnlock.level > 0? "\\lambda" + lambdaExponentText : "")  + " q_t";
                if (isChallengeCleared[2] == 1) result += "\\Omega" + omegaExponentText;
                result += "\\\\ q_t = c_{3}(1-e^{-t})"
                if (isChallengeCleared[2] == 1) result += "\\\\ \\Omega = \\omega_t \\omega_s"
            }
            else {
                result += "\\dot{\\Lambda} = \\Pi ^{" + piExponentText + "} q_{s}^{-1}"
                if (isChallengeCleared[2] == 1) result += "\\Omega";
                result += "\\\\ \\ q_s = \\frac{1}{c_{1s}c_{2s}^2 s(s+1)}"
                if (isChallengeCleared[2] == 1) result += "\\\\ \\Omega = \\omega_t \\omega_s"
            }
            result += "\\end{matrix}"
            return result;
        }

        secondaryEquation() {
            theory.secondaryEquationHeight = 75;
            theory.secondaryEquationScale = 1.4;
            if (laplaceActive) {
                // Equation while under Laplace transform
                let result = "\\begin{matrix}"
                result += "\\dot{t} = -t \\\\"
                result += "\\dot{s} = \\dot{t}"
                result += "\\end{matrix}"
                return result
            }
            else {
                // Default case
                let result = "\\begin{matrix}"
                result += theory.latexSymbol + "=\\max\\rho^{" + tauExponent + "} \\\\";
                result += "\\end{matrix}"
                return result;
            }
        }

        tertiaryEquation() {
            let result = "t = " + this.t.toString() + ", s = " + this.s.toString() + ", ";
            if (laplaceActive) result += "q_s ^{-1} = " + this.getQS().toString() + ", \\Pi = " + theory.publicationMultiplier.toString();
            else result += "q_t = " + this.q.toString();
            return result;
        }

        processPublish() {
            this.q = BigNumber.ONE;
            this.t = BigNumber.ZERO;
            this.s = BigNumber.from((1 + 5 ** 0.5) / 2 - 1)
            this.currency = BigNumber.ZERO;
            this.laplaceCurrency = BigNumber.ZERO;
            resetUpgrades(this.upgrades)
        }

    }
    
    systems = [new MainSystem(), new ChallengeOne(), new ChallengeTwo(), new ChallengeThree, new ChallengeFour()]
}

// Essentially performs a reset of the given upgrades without a publish
var resetUpgrades = (upgradeList) => {
    upgradeList.forEach(upgrade => {
        upgrade.upgrade.level = 0;
    })
}

var updateAvailability = () => {
    // Prevent the purchase of any upgrade while its system is not active
    let inactiveSystems = systems.filter(x => x.systemId != activeSystemId);
    inactiveSystems.forEach(system => {
        for (var upgrade of system.upgrades){
            upgrade.upgrade.isAvailable = false;
        }
    })

    for (var upgradeId in systems[activeSystemId].upgrades) {
        systems[activeSystemId].upgrades[upgradeId].upgrade.isAvailable = systems[activeSystemId].upgrades[upgradeId].laplaceUpgrade == laplaceActive
    }

    systems[0].tDotExponent.upgrade.isAvailable = isChallengeCleared[1] == 1 && !this.laplaceActive && activeSystemId == 0;
    systems[0].omegaT.upgrade.isAvailable = activeSystemId == 0 && isChallengeCleared[2] == 1 && !this.laplaceActive;
    systems[0].omegaS.upgrade.isAvailable = activeSystemId == 0 && isChallengeCleared[2] == 1 && this.laplaceActive;
    systems[3].resetT.isAvailable = activeSystemId == 3;
    systems[3].resetC1SandC2S.isAvailable = activeSystemId == 3;
    systems[4].resetT.isAvailable = activeSystemId == 4;
    challengeUnlock.isAvailable = c1Exponent.level >= 3 && piExponent.level >= 4 && lambdaBase.level >= 2;
}

/**
 * Performs a single update tick by updating all currencies.
 * @param {number} elapsedTime - Real elapsed time since last tick
 * @param {number} multiplier - Multiplier to the elapsed time to account for rewards. (either 1 or 1.5)
 */
var tick = (elapsedTime, multiplier) => {
    systems[activeSystemId].tick(elapsedTime, multiplier);
    currency.value = systems[activeSystemId].currency;
    laplaceCurrency.value = systems[activeSystemId].laplaceCurrency;
    updateAvailability();
    theory.invalidatePrimaryEquation();
    theory.invalidateSecondaryEquation();
    theory.invalidateTertiaryEquation();
}

/**
 * Main formula.
 * @returns {String} LaTeX equation
 */
var getPrimaryEquation = () => {
    return systems[activeSystemId].primaryEquation();
};

/**
 * Formula right below the main one.
 * @returns {String} LaTeX equation
 */
var getSecondaryEquation = () => {
    return systems[activeSystemId].secondaryEquation();
};

/**
 * Formula at the bottom of the equation area.
 * @returns {String} LaTeX equation
 */
var getTertiaryEquation = () => {
    return systems[activeSystemId].tertiaryEquation();
};

/**
 * Defining this function activates 2D visualization.
 * Note: the point must be in the range [-3.4e38, 3.4e38] (single-precision floating point number)
 * @returns {number} Current graph value
 */
var get2DGraphValue = () => currency.value.sign * (BigNumber.ONE + currency.value.abs()).log10().toNumber();

/**
 * @param {String} symbol - LaTeX symbol to use in this formula instead of theory.latexSymbol
 * @returns {String} LaTeX representation of the publication multiplier formula
 */
var getPublicationMultiplierFormula = (symbol) => "\\Pi = \\frac{" + symbol + "^{" + basePubExp / tauExponent + "}}{2}";

/**
 * @param {BigNumber} tau - Tau value at which the publication multiplier should be calculated
 * @returns {BigNumber} Publication multiplier. Note: The result will be clamped to [1,∞)
 */
var getPublicationMultiplier = (tau) => tau.pow(basePubExp / tauExponent) / 2

/**
 * Given the current state of the game, returns the value that tau should have.
 * The game keeps the maximum between the current value of tau and the value
 * returned by this function.
 * @returns {BigNumber} Note: The result will be clamped to [0,∞)
 */
var getTau = () => currency.value > BigNumber.ZERO ? currency.value.pow(tauExponent) : BigNumber.ZERO;

/**
 * Given a value of tau, returns the corresponding value in currency.
 * This function is for display purpose only. All other calculations
 * regarding publication multipliers and milestone costs are done
 * in terms of tau.
 * Example:
 * var getCurrencyFromTau = (tau) => [tau.max(BigNumber.ONE).pow(10), currency.symbol];
 * @param {BigNumber} tau - The tau value to convert. Use the provided parameter since it may be different from the current tau value.
 * @returns {Array.<BigNumber,string>} A pair [currency, symbol] where 'currency' is the currency value corresponding to the tau parameter, and 'symbol' is the symbol of the returned currency. 
 */
var getCurrencyFromTau = (tau) => [tau.max(BigNumber.ONE).pow(1 / tauExponent), currency.symbol];

/**
 * Called right after publishing.
 * A good place to reset your internal state.
 */
var postPublish = () => {
    laplaceActive = false;
    systems[activeSystemId].processPublish()
    theory.invalidateSecondaryEquation();
};

/**
 * You may have to keep track of some internal variables to help calculations.
 * If some values needs to be preserved when reloading the game, serialize
 * these values in the form of a string so that it is part of the save file.
 * @returns {String}
 */
var getInternalState = () => {
    let state = {}

    for (var system of systems) {
        state[system.systemId] = system.getInternalState();
    }

    return JSON.stringify({
        systems: state,
        completedChallenges: isChallengeCleared,
        laplaceActive: laplaceActive,
        activeSystemId: activeSystemId,
        timer: timer,
        tDomainTime: tDomainTime,
        sDomainTime: sDomainTime,
        automationEnabled: automationEnabled
    })
}

/**
 * Given the string that you provided with getInternalState, set the internal
 * state of the theory. This function needs to support empty/corrupted strings.
 * @param {String} state
 */
var setInternalState = (state) => {
    if(state != "") {
        let values = JSON.parse(state);
        if('systems' in values){
            for (var id in values.systems) {
                systems[id].setInternalState(values.systems[id])
            }
        }
        if('activeSystemId' in values) {
            activeSystemId = parseInt(values.activeSystemId);
            updateAvailability();
            theory.invalidatePrimaryEquation();
            theory.invalidateSecondaryEquation();
            theory.invalidateTertiaryEquation();
        }
        if('completedChallenges' in values) isChallengeCleared = values.completedChallenges;
        if('laplaceActive' in values) { laplaceActive = values.laplaceActive; laplaceButton.text = !laplaceActive ? "Apply Laplace Transform" : "Invert Laplace Transform"; }
        if('timer') timer = parseFloat(values.timer);
        if('tDomainTime' in values) { tDomainTime = parseInt(values.tDomainTime); tDomainSlider.value = tDomainTime; }
        if('sDomainTime' in values) { sDomainTime = parseInt(values.sDomainTime); sDomainSlider.value = sDomainTime; }
        if('automationEnabled' in values) { automationEnabled = values.automationEnabled == true; autoLaplaceToggle.isToggled = automationEnabled; }
    }
};

// UI

var laplaceButton = ui.createButton({
    text: !laplaceActive ? "Apply Laplace Transform" : "Invert Laplace Transform",
    onClicked: () => {
        laplaceActive = !laplaceActive;
        timer = 0;
        laplaceButton.text = !laplaceActive ? "Apply Laplace Transform" : "Invert Laplace Transform";
        updateAvailability();
    },
    row: 1,
    column: 0
}
);

var challengeMenuButton = ui.createButton({
    text: "Assignments",
    onClicked: () => {
        let challengeMenu = createChallengeMenu();
        challengeMenu.show();
    },
    row: 1,
    column: 1
}
);

var handInButton = ui.createButton({
    text: "Hand-In",
    onClicked: () => { 
        let menu = challengeCompletionMenu();
        menu.show();
    },
    isVisible: () => activeSystemId != 0,
    row:1,
    column:1
})


var startChallenge = (challengeId) => {
    currency.value = BigNumber.ZERO;
    laplaceCurrency.value = BigNumber.ZERO;
    systems[activeSystemId].processPublish();
    activeSystemId = challengeId;
    updateAvailability();
    theory.invalidatePrimaryEquation();
    theory.invalidateSecondaryEquation();
    theory.invalidateTertiaryEquation();
}

var laplaceAutomationMenu = ui.createPopup({
        title: "Automated Laplace Transform Settings",
        content: ui.createStackLayout({
            children: [
                ui.createLabel({
                    text: "Time in t domain"
                }),
                ui.createLatexLabel({
                    text: () => Utils.getMath(tDomainTime + " \\text{ mins}")
                }),
                tDomainSlider,
                ui.createLabel({
                    text: "Time in s domain"
                }),
                ui.createLatexLabel({
                    text: () => Utils.getMath(sDomainTime + " \\text{ \mins}")
                }),
                sDomainSlider,
                ui.createLabel({
                    text: "Automation Switch"
                }),
                autoLaplaceToggle
            ]
        })
    })
var createChallengeMenu = () => {
    let menu = ui.createPopup({
        title: "Assignments",
    })

    challengeGrid = []
    for (let i = 1; i < systems.length; i++){
        if (systems[i].isUnlocked){
            challengeGrid.push(
                ui.createGrid({
                    columnDefinitions: ["auto", "15*", "auto"],
                    rowDefinitions: ["auto", "auto", "auto"],
                    columnSpacing: 10,
                    rowSpacing: 5,
                    backgroundColor: i % 2 == 1? Color.DARK_BACKGROUND : Color.LIGHT_BACKGROUND,
                    children: [
                        ui.createLatexLabel({text: Utils.getMath("\\begin{matrix} \\text{Assignment "+ i + "} \\\\ \\text{" + systems[i].name + "} \\\\ \\text{max } \\rho = " + systems[i].maxRho.toString() + "\\end{matrix}"), verticalTextAlignment: TextAlignment.CENTER, horizontalOptions: LayoutOptions.CENTER, verticalOptions: LayoutOptions.CENTER, row: i-1, column: 0}),
                        ui.createButton({text: "Start", onClicked: () => { startChallenge(i); menu.hide();}, horizontalOptions: LayoutOptions.CENTER, verticalOptions: LayoutOptions.CENTER, row: i - 1, column: 1 }),
                        ui.createButton({text: "Reward", onClicked: () => { systems[i].viewReward()}, horizontalOptions: LayoutOptions.CENTER, verticalOptions: LayoutOptions.CENTER, row: i - 1, column: 2}), 
                    ]
                })
            )
        }
        else{
            challengeGrid.push(
                ui.createGrid({
                    columnDefinitions: ["20*", "15*", "auto"],
                    rowDefinitions: ["auto", "auto", "auto"],
                    columnSpacing: 10,
                    rowSpacing: 5,
                    backgroundColor: i % 2 == 1? Color.DARK_BACKGROUND : Color.LIGHT_BACKGROUND,
                    children: [
                        ui.createLatexLabel({text: Utils.getMath("\\text{Assignment "+ i + " locked}"), horizontalOptions: LayoutOptions.CENTER, verticalOptions: LayoutOptions.CENTER, row: i - 1, column: 0}),
                        ui.createButton({text: "Unlock", onClicked: () => { menu.hide(); systems[i].unlock(); }, horizontalOptions: LayoutOptions.CENTER, verticalOptions: LayoutOptions.CENTER, row: i - 1, column: 1 })
                    ]
                })
            )
        }
    }

    menu.content = ui.createStackLayout({
        children: challengeGrid
    })

    return menu;
}

var challengeCompletionMenu = () => {
    let menu = ui.createPopup({
        title: "Hand-In Assignment",
    })
    
    menu.content = ui.createStackLayout({
        children: [
            ui.createGrid({
                columnDefinitions: ["20*", "15*", "auto"],
                children: [
                    ui.createLatexLabel({
                        text: Utils.getMath("\\text{Goal: }" + systems[activeSystemId].goal + "\\rho"),
                        row:0,
                        column:0,
                    }),
                    ui.createLatexLabel({
                        text: () => Utils.getMath("\\text{Current: }" + systems[activeSystemId].maxRho + "\\rho"),
                        row:1,
                        column:0,
                    }),
                    ui.createButton({
                        text: () => systems[activeSystemId].maxRho >= systems[activeSystemId].goal? "Complete" : "Exit",
                        onClicked: () => {
                            if(systems[activeSystemId].maxRho >= systems[activeSystemId].goal) isChallengeCleared[activeSystemId - 1] = 1
                            startChallenge(0);
                            menu.hide();
                        },
                        row:2,
                        column:0
                    })
                ]
            })
        ]
    })
    return menu;
}

var getImageSize = (width) => {
    if(width >= 1080)
      return 72;
    if(width >= 720)
      return 54;
    if(width >= 360)
      return 36;
    return 30;
}

var alwaysShowRefundButtons = ()  => {
    return false;
}

var canResetStage = () => activeSystemId != 0;
var resetStage = () => {
    laplaceActive = false;
    systems[activeSystemId].processPublish(); 
}

var getEquationOverlay = () => {
    return ui.createGrid({
      columnDefinitions: ["1*", "3*", "1*"],
      columnSpacing: 0,
      children: [
        ui.createImage({
            useTint: true,
            source: ImageSource.SETTINGS,
            row:0,
            column:0,
            widthRequest: getImageSize(ui.screenWidth),
            heightRequest: getImageSize(ui.screenWidth), 
            horizontalOptions: LayoutOptions.START,
            verticalOptions: LayoutOptions.START,   
            aspect: Aspect.ASPECT_FILL,
            onTouched: (e) => {
                if (e.type.isReleased()) {
                  if (activeSystemId == 1){
                    systems[1].menu.show();
                  }
                  else {
                    laplaceAutomationMenu.show();
                  }
                }
              },
            isVisible: () => activeSystemId == 0 && isChallengeCleared[0] == 1 || activeSystemId == 1    
        }),
        ui.createFrame({
            isVisible: () => activeSystemId != 0,
            row: 0,
            column: 1,
            horizontalOptions: LayoutOptions.FILL_AND_EXPAND,
            verticalOptions: LayoutOptions.START,
            children: [
              ui.createProgressBar({
                progress: () => activeSystemId != 0 ? Math.min((systems[activeSystemId].maxRho.log10() / systems[activeSystemId].goal.log10()).toNumber(), 1) : 0
            }),
            ],
          }),
        ]
      })
}

var getCurrencyBarDelegate = () => {
    challengeMenuButton.isVisible = () => activeSystemId == 0 && challengeUnlock.level > 0;
    laplaceButton.isVisible = () => laplaceTransformUnlock.level > 0;
    currencyBar = ui.createGrid({
        columnDefinitions: ["20*", "30*", "auto"],
        children: [
            currencyBarTau = ui.createLatexLabel({
                text: () => Utils.getMath(theory.tau + theory.latexSymbol),
                row: 0,
                column: 0,
                horizontalTextAlignment: TextAlignment.CENTER,
                horizontalOptions: LayoutOptions.CENTER,
                verticalOptions: LayoutOptions.CENTER,
            }),
            currencyBarCurrency = ui.createLatexLabel({
                text: () => Utils.getMath(currency.value.toString() + "\\rho"),
                row: 0,
                column: 1,
                horizontalTextAlignment: TextAlignment.CENTER,
                horizontalOptions: LayoutOptions.CENTER,
                verticalOptions: LayoutOptions.CENTER,
            }),
            laplaceCurrencyBarCurrency = ui.createLatexLabel({
                text: () => Utils.getMath(laplaceCurrency.value.toString() + "\\Lambda"),
                row: 0,
                column: 2,
                horizontalTextAlignment: TextAlignment.CENTER,
                horizontalOptions: LayoutOptions.CENTER,
                verticalOptions: LayoutOptions.CENTER,
                isVisible: () => laplaceTransformUnlock.level > 0
            }),
            laplaceButton,
            challengeMenuButton,
            handInButton
        ],
    });
    return currencyBar;
}

init();