import { ExponentialCost, FirstFreeCost, FreeCost, LinearCost } from "../api/Costs";
import { Localization } from "../api/Localization";
import { parseBigNumber, BigNumber } from "../api/BigNumber";
import { theory } from "../api/Theory";
import { Utils } from "../api/Utils";
import { TouchType } from "../api/UI/properties/TouchType";

var id = "LT";
var name = "Laplace Transforms";
var tauExponent = 1
var description = "A custom theory based on Laplace transforms.";
var authors = "Gaunter#1337";
var version = "1.0";
var t = BigNumber.ZERO
var currency; 
var laplaceActive = false;
var activeSystemId = 0;
var systems = []

var init = () => {
    currency = theory.createCurrency();
    
    // Takes an upgrade within a challenge object and converts it into a purchasable theory upgrade
    var upgradeFactory = (systemId, upgrade) => {
        let temp = theory.createUpgrade(100*systemId + upgrade.internalId, currency, upgrade.costModel);
        temp.getDescription = upgrade.description;
        temp.getInfo = upgrade.info;
        // Any new upgrades defined this way will be set to false by default and will be available only when the challenge is active
        temp.isAvailable = false;
        if (upgrade.maxLevel) temp.maxLevel = upgrade.maxLevel;
        return temp;
    }

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
            this.q = BigNumber.ONE;
            this.r = BigNumber.ONE;     
            this.q1 = {
                internalId: 1,
                description: (level) => Utils.getMath("q_1=" + Utils.getStepwisePowerSum(level, 2, 10, 0).toString(0)),
                info: (level) =>  Utils.getMathTo("q_1=" + this.getQ1(this.q1.upgrade.level), "q_1=" + Utils.getStepwisePowerSum(level, 2, 10, 0).toString(0)),
                costModel: new ExponentialCost(1e5, Math.log2(18)),
                laplaceUpgrade: false,
            }
    
            this.q2 = {
                internalId: 2,
                description: (level) => Utils.getMath("q_{2}= 2^{" + level + "}"),
                info: (level) =>  Utils.getMathTo("q_2=" + this.getQ2(this.q2.upgrade.level),"q_{2}=" + this.getQ2(level).toString(0)),
                costModel: new ExponentialCost(1e5, Math.log2(18)),
                laplaceUpgrade: false
            }
    
            this.r1 = {
                internalId: 3,
                description: (level) => Utils.getMath("r_{1}=" + Utils.getStepwisePowerSum(level, 2, 10, 0).toString(0)),
                info: (level) =>  Utils.getMathTo("r_1=" + this.getR1(this.r1.upgrade.level),"r_{1}=" + Utils.getStepwisePowerSum(level, 2, 10, 0).toString(0)),
                costModel: new ExponentialCost(1e5, Math.log2(18)),
                laplaceUpgrade: true
            }
    
            this.r2 = {
                internalId: 4,
                description: (level) => Utils.getMath("r_{2}= 2^{" + level + "}"),
                info: (level) =>  Utils.getMathTo("r_2=" + this.getR2(this.r2.upgrade.level),"r_{2}=" + this.getR2(level).toString(0)),
                costModel: new ExponentialCost(1e5, Math.log2(18)),
                laplaceUpgrade: true
            }
    
            this.expS = {
                internalId: 5,
                description: (level) => Utils.getMath(" s = 2^{-" + level + "}"),
                info: (level) => Utils.getMathTo("s = 2^{-" + this.expS.upgrade.level + "}", "s =2^{-" + level + "}"),
                costModel: new ExponentialCost(1e5, Math.log2(18)),
                laplaceUpgrade: true
            }
    
            this.upgrades = [this.q1, this.q2, this.r1, this.r2, this.expS];
            for (var upgrade of this.upgrades){
                let temp = upgradeFactory(this.systemId, upgrade);
                upgrade.upgrade = temp;
            }    
        }

        getQ1(level) { return Utils.getStepwisePowerSum(level, 2, 10, 0); }
        getQ2(level) { return BigNumber.TWO.pow(level); }
        getR1(level) { return Utils.getStepwisePowerSum(level, 2, 10, 0); }
        getR2(level) { return BigNumber.TWO.pow(level); }
        getS(level) { return BigNumber.TWO.pow(-level); }

        tick(elapsedTime, multiplier){
            let dt = BigNumber.from(elapsedTime * multiplier);
            let bonus = getPublicationMultiplier(theory.tau);
            if (laplaceActive) {
                let dr = this.getR1(this.r1.upgrade.level) * this.getR2(this.r2.upgrade.level) / this.getS(this.expS.upgrade.level);
                this.r += dt * dr;
            }
            else {
                this.q += this.getQ1(this.q1.upgrade.level) * this.getQ2(this.q2.upgrade.level);
            }

            this.currency += bonus * this.q * this.r * dt;
            theory.invalidateSecondaryEquation();
        }

        getInternalState(){
            return JSON.stringify({
                q: BigNumber.toString(this.q),
                r: BigNumber.toString(this.r),
                currency: BigNumber.toString(this.currency)
            })
        }
        
        setInternalState(state){
            let values = JSON.parse(state)
            this.q = BigNumber.from(values.q);
            this.r = BigNumber.from(values.r);
            this.currency = BigNumber.from(values.currency);
        }

        primaryEquation(){
           return "\\dot{\\rho} = qr"
        }

        secondaryEquation(){
            theory.secondaryEquationHeight = 75;
            theory.secondaryEquationScale = 1.5;
            if (laplaceActive) {
                // Equation while under Laplace transform
                let result = "\\begin{matrix}"
                result += "s = 2^{-1}\\\\"
                result += "\\dot{r} = \\frac{r_{1}r_{2}}{s}"
                result += "\\end{matrix}"
                return result
            }
            else {
                // Default case
                return "\\dot{q} = q_{1}q_{2}"
            }        
        }

        tertiaryEquation(){
            return "q = " + this.q.toString() + ", r = " + this.r.toString() + ", s = " + this.getS(this.expS.upgrade.level).toString();
        }

        processPublish(){
            q = BigNumber.ONE;
            r = BigNumber.ONE;            
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
    systems[activeSystemId].tick(elapsedTime, multiplier)
    theory.invalidatePrimaryEquation()
    theory.invalidateSecondaryEquation()
    theory.invalidateTertiaryEquation()
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
var getTau = () => theory.tau.pow(tauExponent);

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
var getCurrencyFromTau = (tau) => tau.pow(1/tauExponent);

/**
 * Called right after publishing.
 * A good place to reset your internal state.
 */
var postPublish = () => {
    q, r = BigNumber.ONE;
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

var laplaceButton = ui.createButton({
    text: !laplaceActive? "Apply Laplace Transform" : "Invert Laplace Transform",
    onClicked: () =>{
        laplaceActive = !laplaceActive
        laplaceButton.text = !laplaceActive? "Apply Laplace Transform" : "Invert Laplace Transform"
        updateAvailability()
    }
}
)
/**
 * Returns a UI element (View class) to put on top
 * of the equation area. This function is ignored
 * if getEquationDelegate is defined.
 * @returns{View} An instance of a UI element.
 */
var getEquationOverlay = () => {
    return ui.createGrid({
        columnDefinitions: ["1*", "3*", "1*"],
        columnSpacing: 0,
        children: [
            ui.createFrame({
                row: 0,
                column: 1,
                horizontalOptions: LayoutOptions.FILL_AND_EXPAND,
                verticalOptions: LayoutOptions.START,
                children: [laplaceButton]
            })
        ]
    })
};

init();

//
