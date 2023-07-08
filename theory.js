import { ExponentialCost, FirstFreeCost, FreeCost, LinearCost } from "../api/Costs";
import { Localization } from "../api/Localization";
import { parseBigNumber, BigNumber } from "../api/BigNumber";
import { theory } from "../api/Theory";
import { Utils } from "../api/Utils";
import { log } from "../../../Downloads/TheorySDK.Win.1.4.29/api/Utils";

var id = "LT";
var name = "Laplace Transforms";
var tauExponent = 0.015;
var description = "A custom theory based on Laplace transforms.";
var authors = "Gaunter#1337";
var version = "1.4";
var currency;
var laplaceActive = false;
var activeSystemId = 2;
var systems = []
var timer = 0;
var qtExponent, piExponent, challengeUnlock, laplaceTransformUnlock, lambdaBase;
var tDomainTime = 1;
var sDomainTime = 1;
var automationEnabled = false;

// UI Sliders
var tDomainSlider = ui.createSlider({
    minimum: 1,
    maximum: 60,
    value: tDomainTime,
    onValueChanged: () => {
        tDomainTime = Math.round(tDomainSlider.value)
    }
}); 
var sDomainSlider = ui.createSlider({
    minimum: 1,
    maximum: 60,
    value: sDomainTime,
    onValueChanged: () => {
        sDomainTime = Math.round(sDomainSlider.value)
    }
});
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
        laplaceTransformUnlock.getInfo = (_) => Utils.getMath("\\mathcal{L}\\{f(t)\\} = \\int_{0}^{\\infty}f(t)e^{-st}dt");
    }

    theory.setMilestoneCost(new CustomCost(total => BigNumber.from(getCustomCost(total))));
    ////////////// ///////
    // Milestone Upgrades
    {
        qtExponent = theory.createMilestoneUpgrade(0, 3);
        qtExponent.getDescription = (_) => Localization.getUpgradeIncCustomExpDesc("q_t", 0.05);
        qtExponent.getInfo = (_) => Localization.getUpgradeIncCustomExpInfo("q_t", "0.05");
        qtExponent.boughtOrRefunded = (_) => { theory.invalidatePrimaryEquation(); };
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
        // ensures purchases subtract from system currency also
        temp.boughtOrRefunded = (amount) => {
            if(temp.level - amount >= 0 && upgrade.laplaceUpgrade == false){
                system.currency -= upgrade.costModel.getSum(temp.level - amount, temp.level).min(system.currency);
            }
            else if(temp.level - amount >= 0 && upgrade.laplaceUpgrade == true){
                system.laplaceCurrency -= upgrade.costModel.getSum(temp.level - amount, temp.level).min(system.laplaceCurrency);
            }
        }
        return temp;
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
                description: (_) => Utils.getMath("\\dot{t}=" + this.getTDot(this.tdot.upgrade.level)),
                info: (amount) => Utils.getMathTo("\\dot{t} = " + this.getTDot(this.tdot.upgrade.level), "\\dot{t}=" + this.getTDot(this.tdot.upgrade.level + amount)),
                costModel: new FirstFreeCost(new ExponentialCost(4e2, Math.log2(15))),
                laplaceUpgrade: false
            }

            this.c1s = {
                internalId: 5,
                description: (_) => Utils.getMath("c_{1s} = e^{" + 0.5 * this.c1s.upgrade.level + "}"),
                info: (amount) => Utils.getMathTo("c_{1s} = " + this.getC1S(this.c1s.upgrade.level), "c_{1s} = " + this.getC1S(this.c1s.upgrade.level + amount)),
                costModel: new ExponentialCost(1e5, Math.log2(24)),
                laplaceUpgrade: true,
            }

            this.c2s = {
                internalId: 6,
                description: (_) => Utils.getMath("c_{2s} = " + this.getC2S(this.c2s.upgrade.level)),
                info: (amount) => Utils.getMathTo("c_{2s} = " + this.getC2S(this.c2s.upgrade.level), "c_{2s} = " + this.getC2S(this.c2s.upgrade.level + amount)),
                costModel: new FirstFreeCost(new ExponentialCost(1e6, Math.log2(3))),
                laplaceUpgrade: true
            }

            this.lambda = {
                internalId: 7,
                description: (_) => Utils.getMath("\\lambda = " + 5 * 10 ** (lambdaBase.level) + "^{" + (this.lambda.upgrade.level + this.lambdaExponent.upgrade.level * 0.1)+ "}"),
                info: (amount) => Utils.getMathTo("\\lambda = " + this.getLambda(this.lambda.upgrade.level), "\\lambda_{s} = " + this.getLambda(this.lambda.upgrade.level + amount)),
                costModel: new ExponentialCost(1e7, Math.log2(5e4)),
                laplaceUpgrade: true,
                maxLevel: 40
            }
            this.lambdaExponent = {
                internalId: 8,
                description: (_) => Localization.getUpgradeIncCustomExpDesc("λ", "0.1"),
                info: (_) => Localization.getUpgradeIncCustomExpInfo("λ", "0.1"),
                costModel: new ExponentialCost(1e50, Math.log2(1e40)),
                laplaceUpgrade: true,
            }

            this.upgrades = [this.tdot, this.c1, this.c2, this.c3, this.c1s, this.c2s, this.lambda, this.lambdaExponent];
            for (var upgrade of this.upgrades) {
                let temp = upgradeFactory(this.systemId, upgrade, this);
                // this creates a 'pointer' to the real upgrade within the object instance
                upgrade.upgrade = temp;
            }
        }

        getC1(level) { return Utils.getStepwisePowerSum(level, 2, 10, 1); }
        getC2(level) { return BigNumber.TWO.pow(level); }
        getC3(level) { return BigNumber.TWO.pow(level); }
        getTDot(level) { return 0.05 * Utils.getStepwisePowerSum(level, 2, 10, 0); }
        getC1S(level) { return BigNumber.E.pow(level * 0.5); }
        getC2S(level) { return Utils.getStepwisePowerSum(level, 2, 10, 0); }
        getLambda(level) { return BigNumber.from(5 * 10 ** (lambdaBase.level)).pow(level);}
        getQS() { return (this.getC2S(this.c2s.upgrade.level).pow(2) * this.getC1S(this.c1s.upgrade.level) * this.s * (this.s + 1)); }

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
                this.laplaceCurrency += bonus.pow(0.1 + piExponent.level * 0.1) * this.getQS() * dt;
            }
            else {
                this.t += this.getTDot(this.tdot.upgrade.level) * dt;
                this.q = this.getC3(this.c3.upgrade.level) * (1 - BigNumber.E.pow(-1 * this.t));
                this.currency += bonus * this.getLambda(this.lambda.upgrade.level).pow(1 + this.lambdaExponent.upgrade.level * 0.1) * this.getC1(this.c1.upgrade.level).pow(1 + qtExponent.level * 0.05) * this.getC2(this.c2.upgrade.level) * this.q * dt;
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
            let qExponentText = (qtExponent.level > 0) ? "^{" + (1 + qtExponent.level * 0.05).toString() + "}" : "";
            let piExponentText = (0.1 + piExponent.level * 0.1).toString()
            let result = "\\begin{matrix}";
            if (!laplaceActive) {
                result += "\\dot{\\rho} = c_{1} c_{2} " + (laplaceTransformUnlock.level > 0? "\\lambda_s" : "")  + " q_t" + qExponentText + "\\\\";
                result += "q_t = c_{3}(1-e^{-t})"
            }
            else {
                result += "\\dot{\\Lambda} = \\Pi ^{" + piExponentText + "} q_{s}^{-1}\\\\"
                result += "\\ q_s = \\frac{1}{c_{1s}c_{2s}^2 s(s+1)}"
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

    class ChallengeOne extends System{
        constructor(){
            super();
            this.systemId = 1;
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
                        ui.createLabel({
                            text: "Unlock Laplace Transform automation options."
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
            this.t = BigNumber.ZERO;
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
                        ui.createLabel({
                            text: "Improved scaling for t."
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
                isPaused: `${this.isPaused}`,
                currency: `${this.currency}`,
                laplaceCurrency: `${this.laplaceCurrency}`,
                maxRho: `${this.maxRho}`
            })
        }

        setInternalState(state) {
            let values = JSON.parse(state);
            if(values.t) { this.t = parseBigNumber(values.t); }
            if(values.q) { this.t = parseBigNumber(values.q); }
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
    systems = [new MainSystem(), new ChallengeOne(), new ChallengeTwo()]
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

    challengeUnlock.isAvailable = qtExponent.level >= 3 && piExponent.level >= 3;
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

const basePubExp = 0.15

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
    let values = JSON.parse(state);
    for (var id in values.systems) {
        systems[id].setInternalState(values.systems[id])
    }

    if(values.activeSystemId) activeSystemId = parseInt(values.activeSystemId);
    if(values.laplaceActive) { laplaceActive = values.laplaceActive; laplaceButton.text = !laplaceActive ? "Apply Laplace Transform" : "Invert Laplace Transform"; }
    if(values.timer) timer = parseFloat(values.timer);
    if(values.tDomainTime) { tDomainTime = parseInt(state.tDomainTime); tDomainSlider.value = tDomainTime; }
    if(values.sDomainTime) { sDomainTime = parseInt(state.sDomainTime); sDomainSlider.value = sDomainTime; }
    if(values.automationEnabled) { automationEnabled = state.automationEnabled == "true"; autoLaplaceToggle.isToggled = automationEnabled; }
};

// UI

var laplaceButton = ui.createButton({
    text: !laplaceActive ? "Apply Laplace Transform" : "Invert Laplace Transform",
    onClicked: () => {
        laplaceActive = !laplaceActive
        laplaceButton.text = !laplaceActive ? "Apply Laplace Transform" : "Invert Laplace Transform"
        updateAvailability()
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
                    columnDefinitions: ["20*", "15*", "auto"],
                    children: [
                        ui.createLatexLabel({text: Utils.getMath("\\begin{matrix} \\text{Assignment "+ i + "} \\\\ \\text{max } \\rho = " + systems[i].maxRho.toString() + "\\end{matrix}"), horizontalOptions: LayoutOptions.CENTER, verticalOptions: LayoutOptions.CENTER}),
                        ui.createButton({text: "Start", onClicked: () => { startChallenge(i); menu.hide();}, row: i - 1, column: 1 }),
                        ui.createButton({text: "Reward", onClicked: () => { systems[i].viewReward()}, row: i - 1, column: 2}), 
                    ]
                })
            )
        }
        else{
            challengeGrid.push(
                ui.createGrid({
                    columnDefinitions: ["20*", "15*", "auto"],
                    children: [
                        ui.createLatexLabel({text: Utils.getMath("\\text{Assignment "+ i + " locked}"), horizontalOptions: LayoutOptions.CENTER_AND_EXPAND, verticalOptions: LayoutOptions.CENTER_AND_EXPAND, row: i - 1, column: 0}),
                        ui.createButton({text: "Unlock", onClicked: () => { menu.hide(); systems[i].unlock(); }, row: i - 1, column: 2 })
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
  
var canResetStage = () => activeSystemId != 0;
var resetStage = () => systems[activeSystemId].processPublish();

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
            isVisible: () => activeSystemId == 0 && systems[1].maxRho >= BigNumber.from(1e20) || activeSystemId == 1    
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
    // to be restricted in final version
    challengeMenuButton.isVisible = () => activeSystemId == 0 && challengeUnlock.level > 0;
    // laplaceButton.isVisible = () => laplaceTransformUnlock.level > 0;
    currencyBar = ui.createGrid({
        columnDefinitions: ["20*", "30*", "auto"],
        children: [
            currencyBarTau = ui.createLatexLabel({
                text: () => Utils.getMath(theory.tau + theory.latexSymbol),
                row: 0,
                column: 0,
                horizontalOptions: LayoutOptions.CENTER,
                verticalOptions: LayoutOptions.CENTER,
            }),
            currencyBarCurrency = ui.createLatexLabel({
                text: () => Utils.getMath(currency.value.toString() + "\\rho"),
                row: 0,
                column: 1,
                horizontalOptions: LayoutOptions.CENTER,
                verticalOptions: LayoutOptions.CENTER,
            }),
            laplaceCurrencyBarCurrency = ui.createLatexLabel({
                text: () => Utils.getMath(laplaceCurrency.value.toString() + "\\Lambda"),
                row: 0,
                column: 2,
                horizontalOptions: LayoutOptions.CENTER,
                verticalOptions: LayoutOptions.CENTER,
                // isVisible: () => laplaceTransformUnlock.level > 0
            }),
            laplaceButton,
            challengeMenuButton,
            handInButton
        ],
    });
    return currencyBar;
}

init();