import { ExponentialCost, FirstFreeCost, FreeCost, LinearCost } from "../api/Costs";
import { Localization } from "../api/Localization";
import { parseBigNumber, BigNumber } from "../api/BigNumber";
import { theory } from "../api/Theory";
import { Utils } from "../api/Utils";
import { TouchType } from "../api/UI/properties/TouchType";
import { log } from "../../../Downloads/TheorySDK.Win.1.4.29/api/Utils";

var id = "LT";
var name = "Laplace Transforms";
var tauExponent = 0.015;
var description = "A custom theory based on Laplace transforms.";
var authors = "Gaunter#1337";
var version = "1.3";
var currency;
var laplaceActive = false;
var activeSystemId = 0;
var systems = []
var qtExponent, piExponent, challengeUnlock, laplaceTransformUnlock, lambdaBase, assignmentUnlockUpgrade;

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

    {
        let unlockCosts = new CustomCost((level) => {
            let exponent = 1000
            switch(level + 1) {
                case 1: exponent = 0; break;
                case 2: exponent = 0; break;
            }

            return BigNumber.TEN.pow(exponent)
        })   
        assignmentUnlockUpgrade = theory.createPermanentUpgrade(5, currency, unlockCosts);
        assignmentUnlockUpgrade.maxLevel = 1;
        assignmentUnlockUpgrade.getDescription = (_) => Localization.getUpgradeUnlockDesc("\\text{assignment " + (assignmentUnlockUpgrade.level + 1) + "}");
        assignmentUnlockUpgrade.getInfo = (_) => Localization.getUpgradeUnlockDesc("\\text{assignment " + (assignmentUnlockUpgrade.level + 1) + "}");
        assignmentUnlockUpgrade.isAvailable = false;
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
            if(temp.level - amount > 0 && upgrade.laplaceUpgrade == false){
                system.currency -= upgrade.costModel.getSum(temp.level - amount, temp.level).min(system.currency);
            }
            else if(temp.level - amount > 0 && upgrade.laplaceUpgrade == true){
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
                info: (amount) => Utils.getMathTo("c_3 = " + this.getC3(this.c3.upgrade.level).toString(), "c_3 = " + this.getC3(this.c3.upgrade.level).toString()),
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
                description: (_) => Utils.getMath("\\lambda = " + 5 * 10 ** (lambdaBase.level) + "{" + this.getLambda(this.lambda.upgrade.level) + "}"),
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
            if (laplaceActive) {
                this.s += this.t * (1 - BigNumber.E.pow(-dt));
                this.t = this.t * BigNumber.E.pow(-dt);
                this.laplaceCurrency += bonus.pow(0.1 + piExponent.level * 0.1) * this.getQS()* dt;
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
            this.s = parseBigNumber(values.s);
            this.t = parseBigNumber(values.t);
            this.q = parseBigNumber(values.q)
            this.currency = parseBigNumber(values.currency);
            this.laplaceCurrency = parseBigNumber(values.laplaceCurrency);
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
                result += "\\dot{\\Lambda} = \\Pi ^{" + piExponentText + "} q_{s}\\\\"
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
            this.realS = BigNumber.ONE;
            this.imagS = BigNumber.ZERO;
            this.currency = BigNumber.ZERO;
            this.laplaceCurrency = BigNumber.ZERO;
            this.maxRho = BigNumber.TEN.pow(100);
            this.valueOfTText = Utils.getMath("t = " + this.t.toPrecision(3) + "\\pi")
            this.tSlider = ui.createSlider({
                minimum: 0,
                maximum: 2,
                value: 0,
                onValueChanged: () => {
                    this.t = this.tSlider.value;
                    Utils.getMath("t = " + this.t.toPrecision(3) + "\\pi");
                }
            });

            this.c1 = {
                internalId: 1,
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

            this.upgrades = [this.c1, this.c2];
            for (var upgrade of this.upgrades) {
                let temp = upgradeFactory(this.systemId, upgrade, this);
                // this creates a 'pointer' to the real upgrade within the object instance
                upgrade.upgrade = temp;
            }
        }

        getC1(level) { return Utils.getStepwisePowerSum(level, 2, 10, 1); }
        getC2(level) { return BigNumber.TWO.pow(level); }

        tick(elapsedTime, _) {
            let dt = elapsedTime;
        }

        displayTSliderMenu() {
            let menu = ui.createPopup({
                title: "Value of t Adjustment",
                content: ui.createStackLayout({
                    children: [
                        ui.createLatexLabel(this.valueOfTText),
                        this.tSlider
                    ]
                })
            })
            menu.show();
        }

        primaryEquation() {
            theory.primaryEquationHeight = 75;
            let result = "\\begin{matrix}";
            if (!laplaceActive) {
                result += "\\dot{\\rho} = c_{1} c_{2} q_t";
            }
            else {
                result += "\\lambda_s = \\text{???} \\\\"
                result += "q_s = \\frac{1}{s^2 + 1}"
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
                result += "\\end{matrix}"
                return result
            }
            else {
                // Default case
                let result = "\\begin{matrix}"
                result += "q_t = \\sin(t) \\\\"
                result += "t = " + this.t.toPrecision(3) + "\\pi"
                result += "\\end{matrix}"
                return result;
            }
        }

        tertiaryEquation() {
            let result = "t = " + this.t.toString();
            return result;
        }

        getInternalState() {
            return JSON.stringify({
                t: `${this.t}`,
                currency: `${this.currency}`,
                maxRho: `${this.maxRho}`
            })
        }

        setInternalState(state) {
            let values = JSON.parse(state);
            this.t = parseFloat(values.t);
            this.tSlider.value = this.t;
            this.currency = parseBigNumber(values.currency);
            this.maxRho = parseBigNumber(values.maxRho);
        }

        processPublish(){
            resetUpgrades(this.upgrades);
        }
    }
    systems = [new MainSystem(), new ChallengeOne()]
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
    assignmentUnlockUpgrade.isAvailable = challengeUnlock.level > 0;
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
var getTau = () => currency.value.pow(tauExponent);

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
        activeSystemId: activeSystemId
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

    activeSystemId = parseInt(values.activeSystemId);
    laplaceActive = values.laplaceActive;
    laplaceButton.text = !laplaceActive ? "Apply Laplace Transform" : "Invert Laplace Transform"
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
    text: "View Assignments",
    onClicked: () => {
        let challengeMenu = createChallengeMenu();
        challengeMenu.show();
    },
    row: 1,
    column: 1
}
);

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

var createChallengeMenu = () => {
    let menu = ui.createPopup({
        title: "Assignments (for now, freely accessible)",
    })

    challengeGrid = []
    for (let i = 1; i < systems.length; i++){
        if (i <= assignmentUnlockUpgrade.level){
            challengeGrid.push(
                ui.createGrid({
                    columnDefinitions: ["20*", "15*", "auto"],
                    children: [
                        ui.createLatexLabel({text: Utils.getMath("\\begin{matrix} \\text{Assignment "+ i + "} \\\\ \\text{max } \\rho = " + systems[i].maxRho.toString() + "\\end{matrix}"), horizontalOptions: LayoutOptions.CENTER, verticalOptions: LayoutOptions.CENTER}),
                        ui.createButton({text: "Start Challenge", onClicked: () => { startChallenge(i); menu.hide();}, row: 0, column: 1 }), 
                    ]
                })
            )
        }
        else{
            challengeGrid.push(
                ui.createGrid({
                    columnDefinitions: ["20*", "15*", "auto"],
                    children: [
                        ui.createLatexLabel({text: Utils.getMath("\\text{Assignment "+ i + " locked}"), horizontalOptions: LayoutOptions.CENTER_AND_EXPAND, verticalOptions: LayoutOptions.CENTER_AND_EXPAND}),
                    ]
                })
            )
        }
    }

    if (activeSystemId != 0){
        challengeGrid.push(ui.createButton({
            text: "Exit Challenge",
            onClicked: () => {
                startChallenge(0);
                menu.hide();
            }
        }))
    }

    menu.content = ui.createStackLayout({
        children: challengeGrid
    })

    return menu;
}

var goToPreviousStage = () => {
    // let challengeMenu = createChallengeMenu();
    // challengeMenu.show();
}

var getCurrencyBarDelegate = () => {
    // to be restricted in final version
    challengeMenuButton.isVisible = true // () => challengeUnlock.level > 0;
    laplaceButton.isVisible = () => laplaceTransformUnlock.level > 0;
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
                isVisible: () => laplaceTransformUnlock.level > 0
            }),
            laplaceButton,
            challengeMenuButton
        ],
    });
    return currencyBar;
}

init();