import { ExponentialCost, FirstFreeCost, FreeCost, LinearCost } from "../api/Costs";
import { Localization } from "../api/Localization";
import { parseBigNumber, BigNumber } from "../api/BigNumber";
import { theory } from "../api/Theory";
import { Utils } from "../api/Utils";
import { TouchType } from "../api/UI/properties/TouchType";

var id = "LT";
var name = "Laplace Transforms";
var tauExponent = 0.05;
var description = "A custom theory based on Laplace transforms.";
var authors = "Gaunter#1337";
var version = "1.2";
var currency; 
var laplaceActive = false;
var activeSystemId = 0;
var systems = []
var c1Exponent, rExponent, challengeUnlock;
var init = () => {
    currency = theory.createCurrency();
    getCustomCost = (total) => 25 * (total + 1) * tauExponent;
      /////////////////////
    // Permanent Upgrades
    theory.createPublicationUpgrade(1, currency, 1e8);
    theory.createBuyAllUpgrade(2, currency, 1e10);
    theory.createAutoBuyerUpgrade(3, currency, 1e20);

    theory.setMilestoneCost(new CustomCost(total => BigNumber.from(getCustomCost(total))));
      ////////////// ///////
    // Milestone Upgrades
    {
        c1Exponent = theory.createMilestoneUpgrade(0, 3);
        c1Exponent.getDescription = (_) => Localization.getUpgradeIncCustomExpDesc("q", 0.05);
        c1Exponent.getInfo = (_) => Localization.getUpgradeIncCustomExpInfo("q", "0.05");
        c1Exponent.boughtOrRefunded = (_) => { theory.invalidatePrimaryEquation(); };
    }
    {
        rExponent = theory.createMilestoneUpgrade(1, 3);
        rExponent.getDescription = (_) => Localization.getUpgradeIncCustomExpDesc("r", 0.05);
        rExponent.getInfo = (_) => Localization.getUpgradeIncCustomExpInfo("r", "0.05");
        rExponent.boughtOrRefunded = (_) => { theory.invalidatePrimaryEquation(); };
    }
    {
        challengeUnlock = theory.createMilestoneUpgrade(2,1);
        challengeUnlock.getDescription = (_) => ("Unlock challenges");
        challengeUnlock.getInfo = (_) => ("Unlock challenges");
        // challengeUnlock.canBeRefunded = () => false;
    }


    // Takes an upgrade within each system and converts it into a purchasable theory upgrade
    var upgradeFactory = (systemId, upgrade, system) => {
        let temp = theory.createUpgrade(100*systemId + upgrade.internalId, currency, upgrade.costModel);
        temp.getDescription = upgrade.description;
        temp.getInfo = upgrade.info;
        // Any new upgrades defined this way will be set to false by default and will be available only when the system is active
        temp.isAvailable = false;
        if (upgrade.maxLevel) temp.maxLevel = upgrade.maxLevel;
        // ensures purchases subtract from system currency also
        temp.boughtOrRefunded = (_) => system.currency = currency.value;
        return temp;
    }

    // Defines systems used within the theory including main equation and challenges

    // Abstract Class
    class System {
        systemId;
        upgrades = [];
        currency = BigNumber.ZERO;

        tick = (elapsedTime, multiplier) => { return };

        getInternalState(){
            return JSON.stringify({
                currency: BigNumber.toString(this.currency)
            })
        }

        setInternalState(state){
            let values = JSON.parse(state)
            this.currency = BigNumber.from(values.currency)
        }

        primaryEquation(){
            return ""
        }

        secondaryEquation(){
            return ""
        }

        tertiaryEquation(){
            return ""
        }

        getSystemId() {
            return this.systemId;
        }

        getCurrency(){
            return this.currency;
        }

        processPublish(){
            return;
        }
    }
    
    class MainSystem extends System {        
        constructor(){
            super();
            this.systemId = 0;
            this.s = BigNumber.ONE;
            this.t = BigNumber.ZERO; 
            this.lambda = BigNumber.ONE;
            this.currency = BigNumber.ZERO;    
            this.c1 = {
                internalId: 1,
                description: (_) => Utils.getMath("c_1=" + this.getC1(this.c1.upgrade.level)),
                info: (amount) =>  Utils.getMathTo("c_1=" + this.getC1(this.c1.upgrade.level), "c_1=" + this.getC1(this.c1.upgrade.level + amount)),
                costModel: new ExponentialCost(1e6, Math.log2(2)),
                laplaceUpgrade: false,
            }
    
            this.c2 = {
                internalId: 2,
                description: (_) => Utils.getMath("c_{2}= 2^{" + this.c2.upgrade.level + "}"),
                info: (amount) =>  Utils.getMathTo("c_2=" + this.getC2(this.c2.upgrade.level),"c_{2}=" + this.getC2(this.c2.upgrade.level + amount)),
                costModel: new ExponentialCost(1e8, Math.log2(18)),
                laplaceUpgrade: false
            }

            this.c3 = {
                internalId: 3,
                description: (_) => Utils.getMath("c_3 = 5^{" + this.c3.upgrade.level + "}"),
                info: (amount) => Utils.getMathTo("c_3 = 5^{" + this.c3.upgrade.level + "}", "c_3 = 5^{" + (this.c3.upgrade.level + amount).toString() + "}"),
                costModel: new ExponentialCost(1e2, Math.log2(30)),
                laplaceUpgrade: false
            }
    
            this.tdot = {
                internalId: 4,
                description: (_) => Utils.getMath("\\dot{t}=" + this.getTDot(this.tdot.upgrade.level)),
                info: (amount) =>  Utils.getMathTo("\\dot{t} = " + this.getTDot(this.tdot.upgrade.level), "\\dot{t}=" + this.getTDot(this.tdot.upgrade.level + amount)),
                costModel: new FirstFreeCost(new ExponentialCost(1e4, Math.log2(10))),
                laplaceUpgrade: false
            }
    
            this.sdot = {
                internalId: 5,
                description: (_) => Utils.getMath("\\dot{s}= 2^{" + this.sdot.upgrade.level + "}"),
                info: (amount) =>  Utils.getMathTo("\\dot{s}=" + this.getSDot(this.sdot.upgrade.level),"\\dot{s}=" + this.getSDot(this.sdot.upgrade.level + amount).toString()),
                costModel: new FirstFreeCost(new ExponentialCost(1e2, Math.log2(3))),
                laplaceUpgrade: true
            }
    
            this.c1s = {
                internalId: 6,
                description: (_) => Utils.getMath("c_{1s} = 2^{" + this.c1s.upgrade.level + "}"),
                info: (amount) => Utils.getMathTo("c_{1s} = " + this.getC1S(this.c1s.upgrade.level), "c_{1s} = " + this.getC1S(this.c1s.upgrade.level + amount)),
                costModel: new ExponentialCost(1e3, Math.log2(18)),
                laplaceUpgrade: true
            }

            this.c2s = {
                internalId: 7,
                description: (_) => Utils.getMath("c_{2s} = 10^{" + 0.5 * this.c2s.upgrade.level + "}"),
                info: (amount) => Utils.getMathTo("c_{2s} = " + this.getC2S(this.c2s.upgrade.level), "c_{2s} = " + this.getC2S(this.c2s.upgrade.level + amount)),
                costModel: new ExponentialCost(1e5, Math.log2(24)),
                laplaceUpgrade: true,
            }
    
            this.upgrades = [this.c1, this.c2, this.c3, this.tdot, this.sdot, this.c1s, this.c2s];
            for (var upgrade of this.upgrades){
                let temp = upgradeFactory(this.systemId, upgrade, this);
                // this creates a 'pointer' to the real upgrade within the object instance
                upgrade.upgrade = temp;
            }    
        }

        getC1(level) { return Utils.getStepwisePowerSum(level, 2, 10, 1); }
        getC2(level) { return BigNumber.TWO.pow(level); }
        getC3(level) { return BigNumber.FIVE.pow(level); }
        getTDot(level) { return 0.05 * level; }
        getSDot(level) { return 2 ** level; }
        getC1S(level) { return BigNumber.TWO.pow(level); }
        getC2S(level) { return BigNumber.TEN.pow(level * 0.5);}

        tick(elapsedTime, multiplier){
            let dt = BigNumber.from(elapsedTime * multiplier);
            let bonus = theory.publicationMultiplier;
            if (laplaceActive) {
                this.s += this.getSDot(this.sdot.upgrade.level) * dt;
                this.lambda = -1 * this.q * this.getC1S(this.c1s.upgrade.level) *  this.getC2S(this.c2.upgrade.level) * (this.s * (this.s + 1)).pow(-1).log10();   
            }
            else {
                this.t += this.getTDot(this.tdot.upgrade.level) * dt;
                this.q =  this.getC3(this.c3.upgrade.level) * (1 - BigNumber.E.pow(-1 * this.t));
            }  
            this.currency += bonus * this.getC1(this.c1.upgrade.level).pow(1 + c1Exponent.level * 0.05) * this.getC2(this.c2.upgrade.level) * this.lambda.pow(0.5) * this.q * dt;
            theory.invalidateSecondaryEquation();
        }

        getInternalState(){
            return JSON.stringify({
                s: `${this.s}`,
                t: `${this.t}`,
                lambda: `${this.lambda}`,
                q: `${this.q}`,
                currency: `${this.currency}`
            })
        }
        
        setInternalState(state){
            log(state)
            let values = JSON.parse(state);
            this.s = parseBigNumber(values.s);
            this.t = parseBigNumber(values.t);
            this.q = parseBigNumber(values.q)
            this.lambda = parseBigNumber(values.lambda);
            this.currency = parseBigNumber(values.currency);
            log(this.currency)
        }

        primaryEquation(){
           theory.primaryEquationHeight = 75;
           log(1 + c1Exponent.level * 0.05)
           let qExponentText = (c1Exponent.level > 0)? "^{" + (1 + c1Exponent.level * 0.05).toString() + "}" : "";
           let result = "\\begin{matrix}";
           result += "\\dot{\\rho} = c_{1}c_{2}\\sqrt{\\lambda_s \\lambda_t} q_t" + qExponentText + "\\\\";
           result += theory.latexSymbol + "=\\max\\rho^{" + tauExponent + "} \\\\";
           result += "\\end{matrix}"
           return result;
        }

        secondaryEquation(){
            theory.secondaryEquationHeight = 75;
            theory.secondaryEquationScale = 1.4;
            if (laplaceActive) {
                // Equation while under Laplace transform
                let result = "\\begin{matrix}"
                result += "\\lambda_s = -c_{1s}q_{t}\\log_{10}(q_s) \\\\"
                result += "\\ q_s = \\frac{1}{c_{2s}s(s+1)}"
                result += "\\end{matrix}"
                return result
            }
            else {
                // Default case
                let result =  "\\begin{matrix}"
                result += "\\lambda_t = 1 \\\\"
                result += "q_t = c_{3}(1-e^{-t})"
                result += "\\end{matrix}"
                return result;
            }        
        }

        tertiaryEquation(){
            return "\\lambda_s = " + this.lambda.toString() + ", q_t = " + this.q.toString() + ", t = " + this.t.toString() + ", s = " + this.s.toString();
        }

        processPublish(){
            this.q = BigNumber.ONE;
            this.t = BigNumber.ONE;  
            this.currency = BigNumber.ZERO;          
        }

    }
    
    systems = [new MainSystem()] 
}

var updateAvailability = () => {
    for (var upgradeId in systems[activeSystemId].upgrades){
        systems[activeSystemId].upgrades[upgradeId].upgrade.isAvailable = systems[activeSystemId].upgrades[upgradeId].laplaceUpgrade == laplaceActive
    }
}

/**
 * Performs a single update tick by updating all currencies.
 * @param {number} elapsedTime - Real elapsed time since last tick
 * @param {number} multiplier - Multiplier to the elapsed time to account for rewards. (either 1 or 1.5)
 */
var tick = (elapsedTime, multiplier) => {
    systems[activeSystemId].tick(elapsedTime, multiplier);
    currency.value = systems[activeSystemId].currency;
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
var getPublicationMultiplierFormula = (symbol) => "\\frac{" + symbol + "}^{" + basePubExp / tauExponent + "}{2}";

/**
 * @param {BigNumber} tau - Tau value at which the publication multiplier should be calculated
 * @returns {BigNumber} Publication multiplier. Note: The result will be clamped to [1,∞)
 */
var getPublicationMultiplier = (tau) => tau.pow(basePubExp/tauExponent)/2

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
var getCurrencyFromTau = (tau) => [tau.max(BigNumber.ONE).pow(1/tauExponent), currency.symbol];

/**
 * Called right after publishing.
 * A good place to reset your internal state.
 */
var postPublish = () => {
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

    for (var system of systems){
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
    for (var id in values.systems){
        systems[id].setInternalState(values.systems[id])
    }
    
    activeSystemId = parseInt(values.activeSystemId);
    laplaceActive = values.laplaceActive;
};

// UI

var laplaceButton = ui.createButton({
    text: !laplaceActive? "Apply Laplace Transform" : "Invert Laplace Transform",
    onClicked: () =>{
        laplaceActive = !laplaceActive
        laplaceButton.text = !laplaceActive? "Apply Laplace Transform" : "Invert Laplace Transform"
        updateAvailability()
    },
    row: 1,
    column: 0
}
);

var challengeMenuButton = ui.createButton({
    text: "Open Challenges",
    onClicked: () =>{
        let challengeMenu = createChallengeMenu();
        challengeMenu.show();
    },
    row:1,
    column: 1
}
);

var createChallengeMenu = () => {
    let menu = ui.createPopup({
        title: "Challenges - Coming Soon...",
        content: ui.createStackLayout({
            }),
    })
    return menu;
}

var goToPreviousStage = () => {
    log("hello");
   // let challengeMenu = createChallengeMenu();
   // challengeMenu.show();
}

var getCurrencyBarDelegate = () => {
    challengeMenuButton.isVisible = () => challengeUnlock.level > 0;
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
            laplaceButton,
            challengeMenuButton
        ],
    });
    return currencyBar;
}

init();