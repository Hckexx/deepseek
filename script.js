/**
 * Professional Position Size Calculator & Risk Management Terminal
 * Version 2.0 – Direction toggle, copy/clear, error display.
 */

// ==========================================
// 1. SYSTEM CONFIGURATION & CONSTANTS
// ==========================================

const ASSET_DICTIONARY = {
    XAUUSD: { lotSize: 100, pipSize: 0.1, type: 'commodity' },
    BTCUSD: { lotSize: 1, pipSize: 1, type: 'crypto' },
    EURUSD: { lotSize: 100000, pipSize: 0.0001, type: 'forex' },
    GBPUSD: { lotSize: 100000, pipSize: 0.0001, type: 'forex' },
    US30:   { lotSize: 1, pipSize: 1, type: 'index' },
    NAS100: { lotSize: 1, pipSize: 1, type: 'index' },
    custom: { lotSize: 1, pipSize: 0.01, type: 'custom' }
};

const FORMATTERS = {
    currency: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
    lots: new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    pips: new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    ratio: new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
};

// ==========================================
// 2. STATE MANAGEMENT
// ==========================================

const state = {
    inputs: {
        balance: 5000,
        riskType: 'percent',
        riskValue: 0.5,
        asset: 'XAUUSD',
        direction: 'BUY',    // 'BUY' or 'SELL'
        entry: null,
        sl: null,
        tp: null
    },
    results: {
        isValid: false,
        validationError: '',
        dollarRisk: 0,
        slDistancePrice: 0,
        slDistancePips: 0,
        units: 0,
        lots: 0,
        rrRatio: 0,
        potentialProfit: 0,
        potentialLoss: 0
    }
};

// ==========================================
// 3. CORE TRADING MATHEMATICS (PURE FUNCTIONS)
// ==========================================

const MathCore = {
    calculateDollarRisk(balance, riskType, riskValue) {
        return riskType === 'percent' ? balance * (riskValue / 100) : riskValue;
    },

    calculateDistance(priceA, priceB) {
        return Math.abs(priceA - priceB);
    },

    calculatePositionSize(dollarRisk, slDistancePrice, lotSize) {
        if (slDistancePrice <= 0) return { units: 0, lots: 0 };
        const units = dollarRisk / slDistancePrice;
        const lots = units / lotSize;
        return { units, lots };
    }
};

// ==========================================
// 4. VALIDATION ENGINE
// ==========================================

const Validator = {
    validateTrade(inputs) {
        const { entry, sl, tp, direction, balance, riskValue } = inputs;
        
        if (balance <= 0 || riskValue <= 0) return "Invalid account parameters.";
        if (!entry || !sl) return "Entry and Stop Loss are required.";
        if (entry === sl) return "Entry cannot equal Stop Loss.";

        if (direction === 'BUY') {
            if (sl >= entry) return "Buy invalid: SL must be below Entry.";
            if (tp && tp <= entry) return "Buy invalid: TP must be above Entry.";
        } else {
            if (sl <= entry) return "Sell invalid: SL must be above Entry.";
            if (tp && tp >= entry) return "Sell invalid: TP must be below Entry.";
        }

        return null; // valid
    }
};

// ==========================================
// 5. BUSINESS LOGIC CONTROLLER
// ==========================================

function evaluateTrade() {
    const assetConfig = ASSET_DICTIONARY[state.inputs.asset] || ASSET_DICTIONARY['custom'];
    
    const errorMessage = Validator.validateTrade(state.inputs);
    if (errorMessage) {
        state.results.isValid = false;
        state.results.validationError = errorMessage;
        UI.render();
        return;
    }

    const { entry, sl, tp, balance, riskType, riskValue } = state.inputs;
    
    const dollarRisk = MathCore.calculateDollarRisk(balance, riskType, riskValue);
    const slDistancePrice = MathCore.calculateDistance(entry, sl);
    const slDistancePips = slDistancePrice / assetConfig.pipSize;
    
    const { units, lots } = MathCore.calculatePositionSize(dollarRisk, slDistancePrice, assetConfig.lotSize);
    
    let rrRatio = 0;
    let potentialProfit = 0;
    
    if (tp) {
        const tpDistancePrice = MathCore.calculateDistance(tp, entry);
        rrRatio = tpDistancePrice / slDistancePrice;
        potentialProfit = units * tpDistancePrice;
    }

    state.results = {
        isValid: true,
        validationError: '',
        dollarRisk,
        slDistancePrice,
        slDistancePips,
        units,
        lots,
        rrRatio,
        potentialProfit,
        potentialLoss: dollarRisk
    };

    UI.render();
}

// ==========================================
// 6. DOM MANAGEMENT & EVENT BINDING
// ==========================================

const UI = {
    elements: {},

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.setInitialDirectionUI();
        evaluateTrade();
    },

    cacheDOM() {
        // Inputs
        this.elements.balance = document.getElementById('accountBalance');
        this.elements.riskType = document.getElementById('riskType');
        this.elements.riskValue = document.getElementById('riskValue');
        this.elements.asset = document.getElementById('asset');
        this.elements.direction = document.getElementById('tradeDirection');
        this.elements.entry = document.getElementById('entryPrice');
        this.elements.sl = document.getElementById('stopLoss');
        this.elements.tp = document.getElementById('takeProfit');

        // Buttons
        this.elements.btnBuy = document.getElementById('btnBuy');
        this.elements.btnSell = document.getElementById('btnSell');
        this.elements.btnClear = document.getElementById('btnClear');
        this.elements.btnCopy = document.getElementById('btnCopy');

        // Labels & Error
        this.elements.riskValueLabel = document.getElementById('riskValueLabel');
        this.elements.errorDisplay = document.getElementById('errorDisplay');

        // Outputs
        this.elements.outLotSize = document.getElementById('outLotSize');
        this.elements.outDollarRisk = document.getElementById('outDollarRisk');
        this.elements.outSlDistance = document.getElementById('outSlDistance');
        this.elements.outRrRatio = document.getElementById('outRrRatio');
        this.elements.outPotentialProfit = document.getElementById('outPotentialProfit');
        this.elements.outPotentialLoss = document.getElementById('outPotentialLoss');
        
        this.elements.toast = document.getElementById('toast');
    },

    bindEvents() {
        // Number inputs
        ['balance', 'riskValue', 'entry', 'sl', 'tp'].forEach(id => {
            if (this.elements[id]) {
                this.elements[id].addEventListener('input', (e) => {
                    state.inputs[id] = e.target.value === '' ? null : parseFloat(e.target.value);
                    evaluateTrade();
                });
            }
        });

        // Select inputs
        if (this.elements.riskType) {
            this.elements.riskType.addEventListener('change', (e) => {
                state.inputs.riskType = e.target.value;
                this.updateRiskLabel();
                evaluateTrade();
            });
        }
        if (this.elements.asset) {
            this.elements.asset.addEventListener('change', (e) => {
                state.inputs.asset = e.target.value;
                evaluateTrade();
            });
        }

        // Direction buttons
        if (this.elements.btnBuy) {
            this.elements.btnBuy.addEventListener('click', () => this.setDirection('BUY'));
        }
        if (this.elements.btnSell) {
            this.elements.btnSell.addEventListener('click', () => this.setDirection('SELL'));
        }

        // Clear & Copy
        if (this.elements.btnClear) this.elements.btnClear.addEventListener('click', () => this.clearForm());
        if (this.elements.btnCopy) this.elements.btnCopy.addEventListener('click', () => this.copyResults());
    },

    setInitialDirectionUI() {
        // Ensure button state matches default 'BUY'
        if (this.elements.btnBuy && this.elements.btnSell) {
            this.elements.btnBuy.classList.add('active');
            this.elements.btnSell.classList.remove('active');
        }
    },

    setDirection(direction) {
        state.inputs.direction = direction;
        if (this.elements.direction) this.elements.direction.value = direction;
        // Toggle active class
        if (direction === 'BUY') {
            this.elements.btnBuy.classList.add('active');
            this.elements.btnSell.classList.remove('active');
        } else {
            this.elements.btnSell.classList.add('active');
            this.elements.btnBuy.classList.remove('active');
        }
        evaluateTrade();
    },

    updateRiskLabel() {
        if (this.elements.riskValueLabel) {
            this.elements.riskValueLabel.textContent =
                state.inputs.riskType === 'percent' ? 'Risk Value (%)' : 'Risk Value ($)';
        }
    },

    render() {
        // Hide error display
        if (this.elements.errorDisplay) this.elements.errorDisplay.style.display = 'none';

        if (!state.results.isValid) {
            this.renderError();
            return;
        }

        const res = state.results;
        
        this.elements.outLotSize.textContent = `${FORMATTERS.lots.format(res.lots)} Lots`;
        this.elements.outDollarRisk.textContent = FORMATTERS.currency.format(res.dollarRisk);
        this.elements.outSlDistance.textContent = `${FORMATTERS.pips.format(res.slDistancePips)} pips`;
        this.elements.outPotentialLoss.textContent = FORMATTERS.currency.format(res.potentialLoss);

        if (res.rrRatio > 0) {
            this.elements.outRrRatio.textContent = `${FORMATTERS.ratio.format(res.rrRatio)} : 1`;
            this.elements.outPotentialProfit.textContent = FORMATTERS.currency.format(res.potentialProfit);
        } else {
            this.elements.outRrRatio.textContent = '--';
            this.elements.outPotentialProfit.textContent = '$0.00';
        }
    },

    renderError() {
        // Blank outputs
        this.elements.outLotSize.textContent = '--';
        this.elements.outDollarRisk.textContent = '--';
        this.elements.outSlDistance.textContent = '--';
        this.elements.outRrRatio.textContent = '--';
        this.elements.outPotentialProfit.textContent = '--';
        this.elements.outPotentialLoss.textContent = '--';

        // Show error
        if (this.elements.errorDisplay) {
            this.elements.errorDisplay.textContent = state.results.validationError;
            this.elements.errorDisplay.style.display = 'block';
        }
    },

    clearForm() {
        // Reset all inputs to defaults (keep balance as is? let's reset to 5000)
        if (this.elements.balance) this.elements.balance.value = 5000;
        if (this.elements.riskType) this.elements.riskType.value = 'percent';
        if (this.elements.riskValue) this.elements.riskValue.value = 0.5;
        if (this.elements.asset) this.elements.asset.value = 'custom';
        if (this.elements.entry) this.elements.entry.value = '';
        if (this.elements.sl) this.elements.sl.value = '';
        if (this.elements.tp) this.elements.tp.value = '';

        // Reset direction to BUY
        this.setDirection('BUY');

        // Update state
        state.inputs.balance = 5000;
        state.inputs.riskType = 'percent';
        state.inputs.riskValue = 0.5;
        state.inputs.asset = 'custom';
        state.inputs.entry = null;
        state.inputs.sl = null;
        state.inputs.tp = null;

        this.updateRiskLabel();
        evaluateTrade();
    },

    copyResults() {
        if (!state.results.isValid) {
            this.showToast('No valid results to copy.');
            return;
        }
        const r = state.results;
        const asset = state.inputs.asset;
        const dir = state.inputs.direction;
        const text = [
            `Trade Setup: ${dir} ${asset}`,
            `Lot Size: ${FORMATTERS.lots.format(r.lots)} Lots`,
            `Risk: ${FORMATTERS.currency.format(r.dollarRisk)}`,
            `SL Distance: ${FORMATTERS.pips.format(r.slDistancePips)} pips`,
            r.rrRatio > 0 ? `R:R = ${FORMATTERS.ratio.format(r.rrRatio)} : 1` : null,
            `Potential Profit: ${FORMATTERS.currency.format(r.potentialProfit)}`,
        ].filter(Boolean).join('\n');
        
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('Results copied to clipboard!');
        });
    },

    showToast(msg) {
        const toast = this.elements.toast;
        toast.textContent = msg;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 2000);
    }
};

// Bootstrap
document.addEventListener('DOMContentLoaded', () => UI.init());