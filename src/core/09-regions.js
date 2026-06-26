function pointSnapshot(point) {
    return {
        pageX: point.pageX,
        pageY: point.pageY,
        clientX: point.clientX,
        clientY: point.clientY,
        localX: point.localX,
        localY: point.localY,
        ratioX: point.ratioX,
        ratioY: point.ratioY,
        clampedRatioX: point.clampedRatioX,
        clampedRatioY: point.clampedRatioY,
        region: point.region,
        halfRegion: point.halfRegion,
        edgeRegion: point.edgeRegion,
        area: point.area
    };
}

function phaseDX(point) {
    return point.x - (point.phaseStartX !== undefined ? point.phaseStartX : point.startX);
}

function phaseDY(point) {
    return point.y - (point.phaseStartY !== undefined ? point.phaseStartY : point.startY);
}

function gridFor(point, options) {
    const opt = options || {};
    const rows = Math.max(1, opt.rows || 3);
    const cols = Math.max(1, opt.cols || 3);
    const x = clamp(point && point.clampedRatioX !== undefined ? point.clampedRatioX : point && point.ratioX !== undefined ? point.ratioX : 0, 0, 1);
    const y = clamp(point && point.clampedRatioY !== undefined ? point.clampedRatioY : point && point.ratioY !== undefined ? point.ratioY : 0, 0, 1);
    const col = Math.min(cols - 1, Math.floor(x * cols));
    const row = Math.min(rows - 1, Math.floor(y * rows));
    return {
        row,
        col,
        rows,
        cols,
        index: row * cols + col
    };
}

function gridCellName(cell) {
    const rowName = cell.row === 0 ? 'top' : cell.row === cell.rows - 1 ? 'bottom' : cell.rows % 2 === 1 && cell.row === Math.floor(cell.rows / 2) ? 'center' : 'row' + cell.row;
    const colName = cell.col === 0 ? 'left' : cell.col === cell.cols - 1 ? 'right' : cell.cols % 2 === 1 && cell.col === Math.floor(cell.cols / 2) ? 'center' : 'col' + cell.col;
    if (rowName === 'center' && colName === 'center') return 'center';
    if (rowName === 'center') return colName;
    if (colName === 'center') return rowName;
    return rowName + '-' + colName;
}

const invalidCriteria = Object.freeze({ __handtrickInvalidCriteria: true });
const locationPhaseKeys = listSet(['current', 'start', 'tapStart', 'sequenceStart']);
const gridCriteriaKeys = listSet(['rows', 'cols', 'row', 'col', 'index', 'cell']);
const gridFilterKeys = ['row', 'col', 'index', 'cell'];
const compoundGridKeys = listSet(['rows', 'cols', 'row', 'col', 'index', 'cell', 'current', 'start', 'tapStart', 'sequenceStart']);

function isInvalidCriteria(value) {
    return value === invalidCriteria || !!(value && value.__handtrickInvalidCriteria);
}

function cloneCriteriaValue(value) {
    if (Array.isArray(value)) return value.map(cloneCriteriaValue);
    if (isPlainObject(value)) {
        const out = {};
        Object.keys(value).forEach(key => {
            out[key] = cloneCriteriaValue(value[key]);
        });
        return out;
    }
    return value;
}

function criteriaValueStableKey(value) {
    if (Array.isArray(value)) return '[' + value.map(criteriaValueStableKey).sort().join('|') + ']';
    if (isPlainObject(value)) return '{' + Object.keys(value).sort().map(key => key + ':' + criteriaValueStableKey(value[key])).join('|') + '}';
    return typeof value + ':' + String(value);
}

function criteriaValuesEqual(a, b) {
    return criteriaValueStableKey(a) === criteriaValueStableKey(b);
}

function gridHasFilter(value) {
    return gridFilterKeys.some(key => value[key] !== undefined && value[key] !== null);
}

function gridObjectKeysKnown(value) {
    return isPlainObject(value) && Object.keys(value).every(key => gridCriteriaKeys[key]);
}

function normalizeGridLeafObject(value, parent) {
    if (!gridObjectKeysKnown(value)) return { valid: false };
    const out = {};
    const inherited = parent || {};
    if (value.rows !== undefined) out.rows = cloneCriteriaValue(value.rows);
    else if (inherited.rows !== undefined) out.rows = cloneCriteriaValue(inherited.rows);
    if (value.cols !== undefined) out.cols = cloneCriteriaValue(value.cols);
    else if (inherited.cols !== undefined) out.cols = cloneCriteriaValue(inherited.cols);
    gridFilterKeys.forEach(key => {
        if (value[key] !== undefined && value[key] !== null) out[key] = cloneCriteriaValue(value[key]);
    });
    if (!gridHasFilter(out)) return { valid: false };
    return { valid: true, value: out };
}

function gridLeafFromCompound(value) {
    const out = {};
    ['rows', 'cols'].concat(gridFilterKeys).forEach(key => {
        if (value[key] !== undefined && value[key] !== null) out[key] = cloneCriteriaValue(value[key]);
    });
    return out;
}

function normalizeLegacyGridCriteria(criteria) {
    if (criteria === undefined || criteria === null) return { valid: true, value: criteria };
    if (Array.isArray(criteria)) {
        const out = [];
        for (let index = 0; index < criteria.length; index++) {
            const item = normalizeLegacyGridCriteria(criteria[index]);
            if (!item.valid) return { valid: false };
            out.push(item.value);
        }
        return { valid: true, value: out };
    }
    if (typeof criteria === 'number') return { valid: true, value: { index: criteria } };
    if (typeof criteria === 'string') return { valid: true, value: criteria };
    if (isPlainObject(criteria)) return normalizeGridLeafObject(criteria);
    return { valid: true, value: { cell: criteria } };
}

function gridContext(parent) {
    const opt = parent || {};
    const hasRows = opt.rows !== undefined && opt.rows !== null;
    const hasCols = opt.cols !== undefined && opt.cols !== null;
    const rows = Math.max(1, opt.rows || 3);
    const cols = Math.max(1, opt.cols || 3);
    const base = {};
    if (hasRows) base.rows = cloneCriteriaValue(opt.rows);
    if (hasCols) base.cols = cloneCriteriaValue(opt.cols);
    return { rows, cols, base };
}

function uniqueNumbers(values) {
    const seen = {};
    return values.filter(value => {
        const key = String(value);
        if (seen[key]) return false;
        seen[key] = true;
        return true;
    });
}

function singleOrArray(values) {
    const out = uniqueNumbers(values);
    return out.length === 1 ? out[0] : out;
}

function middleCells(size) {
    const mid = Math.floor(size / 2);
    return size % 2 ? [mid] : [mid - 1, mid];
}

function gridTokenCriteria(value, parent) {
    const token = String(value || '').toLowerCase().trim();
    const context = gridContext(parent);
    const rows = context.rows;
    const cols = context.cols;
    const base = context.base;
    const rowLast = rows - 1;
    const colLast = cols - 1;
    const corner = token.match(/^(top|bottom)-(left|right)$/);
    const rowMatch = token.match(/^row(\d+)$/);
    const colMatch = token.match(/^col(\d+)$/);
    const cellMatch = token.match(/^row(\d+)-col(\d+)$/);

    if (token === 'any') return Object.assign({}, base, { row: singleOrArray(Array.from({ length: rows }, (_, index) => index)) });
    if (token === 'top') return Object.assign({}, base, { row: 0 });
    if (token === 'bottom') return Object.assign({}, base, { row: rowLast });
    if (token === 'left') return Object.assign({}, base, { col: 0 });
    if (token === 'right') return Object.assign({}, base, { col: colLast });
    if (token === 'center') return Object.assign({}, base, { row: singleOrArray(middleCells(rows)), col: singleOrArray(middleCells(cols)) });
    if (token === 'edge') return [
        Object.assign({}, base, { row: singleOrArray([0, rowLast]) }),
        Object.assign({}, base, { col: singleOrArray([0, colLast]) })
    ];
    if (corner) {
        return Object.assign({}, base, {
            row: corner[1] === 'top' ? 0 : rowLast,
            col: corner[2] === 'left' ? 0 : colLast
        });
    }
    if (rowMatch) return Object.assign({}, base, { row: parseInt(rowMatch[1], 10) });
    if (colMatch) return Object.assign({}, base, { col: parseInt(colMatch[1], 10) });
    if (cellMatch) return Object.assign({}, base, { row: parseInt(cellMatch[1], 10), col: parseInt(cellMatch[2], 10) });
    return null;
}

function normalizeGridPhaseLocation(value, parent) {
    if (Array.isArray(value)) {
        const out = [];
        for (let index = 0; index < value.length; index++) {
            const item = normalizeGridPhaseLocation(value[index], parent);
            if (!item.valid) return { valid: false };
            if (Array.isArray(item.value)) out.push.apply(out, item.value);
            else out.push(item.value);
        }
        return { valid: true, value: out };
    }
    if (typeof value === 'number') return { valid: true, value: Object.assign({}, parent || {}, { index: value }) };
    if (typeof value === 'string') {
        const criteria = gridTokenCriteria(value, parent);
        return criteria ? { valid: true, value: criteria } : { valid: false };
    }
    if (isPlainObject(value)) return normalizeGridLeafObject(value, parent);
    return { valid: false };
}

function intersectCriteriaValue(a, b) {
    if (criteriaValuesEqual(a, b)) return { valid: true, value: cloneCriteriaValue(a) };
    const left = Array.isArray(a) ? a : [a];
    const right = Array.isArray(b) ? b : [b];
    const rightSet = right.reduce((out, item) => {
        out[criteriaValueStableKey(item)] = true;
        return out;
    }, {});
    const intersection = left.filter(item => rightSet[criteriaValueStableKey(item)]);
    if (!intersection.length) return { valid: false };
    return { valid: true, value: intersection.length === 1 ? cloneCriteriaValue(intersection[0]) : intersection.map(cloneCriteriaValue) };
}

function mergeGridLeafObjects(a, b) {
    const left = normalizeLegacyGridCriteria(a);
    const right = normalizeLegacyGridCriteria(b);
    if (!left.valid || !right.valid || !isPlainObject(left.value) || !isPlainObject(right.value)) return { valid: false };
    const out = {};
    const keys = ['rows', 'cols'].concat(gridFilterKeys);
    for (let index = 0; index < keys.length; index++) {
        const key = keys[index];
        const leftValue = left.value[key];
        const rightValue = right.value[key];
        if (leftValue === undefined || leftValue === null) {
            if (rightValue !== undefined && rightValue !== null) out[key] = cloneCriteriaValue(rightValue);
            continue;
        }
        if (rightValue === undefined || rightValue === null) {
            out[key] = cloneCriteriaValue(leftValue);
            continue;
        }
        const merged = intersectCriteriaValue(leftValue, rightValue);
        if (!merged.valid) return { valid: false };
        out[key] = merged.value;
    }
    return gridHasFilter(out) ? { valid: true, value: out } : { valid: false };
}

function mergeGridCriteria(a, b) {
    if (a === undefined || a === null) return { valid: true, value: cloneCriteriaValue(b) };
    if (b === undefined || b === null) return { valid: true, value: cloneCriteriaValue(a) };
    const left = Array.isArray(a) ? a : [a];
    const right = Array.isArray(b) ? b : [b];
    const out = [];
    const seen = {};
    for (let leftIndex = 0; leftIndex < left.length; leftIndex++) {
        for (let rightIndex = 0; rightIndex < right.length; rightIndex++) {
            const merged = mergeGridLeafObjects(left[leftIndex], right[rightIndex]);
            if (!merged.valid) continue;
            const key = criteriaValueStableKey(merged.value);
            if (seen[key]) continue;
            seen[key] = true;
            out.push(merged.value);
        }
    }
    if (!out.length) return { valid: false };
    return { valid: true, value: out.length === 1 ? out[0] : out };
}

function normalizeGridCriteria(value) {
    if (!isPlainObject(value)) {
        const legacy = normalizeLegacyGridCriteria(value);
        return legacy.valid ? { valid: true, filters: { grid: legacy.value } } : { valid: false };
    }
    if (!Object.keys(value).every(key => compoundGridKeys[key])) return { valid: false };
    const hasPhase = Object.keys(locationPhaseKeys).some(key => value[key] !== undefined && value[key] !== null);
    const hasLegacyFilter = gridFilterKeys.some(key => value[key] !== undefined && value[key] !== null);

    if (!hasPhase) {
        const legacy = normalizeLegacyGridCriteria(value);
        return legacy.valid ? { valid: true, filters: { grid: legacy.value } } : { valid: false };
    }

    const parent = {};
    if (value.rows !== undefined && value.rows !== null) parent.rows = cloneCriteriaValue(value.rows);
    if (value.cols !== undefined && value.cols !== null) parent.cols = cloneCriteriaValue(value.cols);

    const filters = {};
    if (hasLegacyFilter) {
        const current = normalizeGridLeafObject(gridLeafFromCompound(value));
        if (!current.valid) return { valid: false };
        filters.grid = current.value;
    }

    const phaseMap = {
        current: 'grid',
        start: 'startGrid',
        tapStart: 'tapStartGrid',
        sequenceStart: 'sequenceStartGrid'
    };

    for (let index = 0; index < Object.keys(phaseMap).length; index++) {
        const phase = Object.keys(phaseMap)[index];
        if (value[phase] === undefined || value[phase] === null) continue;
        const normalized = normalizeGridPhaseLocation(value[phase], parent);
        if (!normalized.valid) return { valid: false };
        const key = phaseMap[phase];
        if (filters[key] === undefined) {
            filters[key] = normalized.value;
            continue;
        }
        const merged = mergeGridCriteria(filters[key], normalized.value);
        if (!merged.valid) return { valid: false };
        filters[key] = merged.value;
    }

    return Object.keys(filters).length ? { valid: true, filters } : { valid: false };
}

function normalizePhaseLocation(value, keys) {
    if (!isPlainObject(value)) return { valid: true, filters: { current: cloneCriteriaValue(value) } };
    if (!Object.keys(value).every(key => locationPhaseKeys[key])) return { valid: false };
    const filters = {};
    Object.keys(locationPhaseKeys).forEach(key => {
        if (value[key] !== undefined && value[key] !== null) filters[key] = cloneCriteriaValue(value[key]);
    });
    return Object.keys(filters).length ? { valid: true, filters } : { valid: false };
}

function mergeSimpleCriteria(existing, value) {
    if (existing === undefined || existing === null) return { valid: true, value: cloneCriteriaValue(value) };
    if (value === undefined || value === null) return { valid: true, value: cloneCriteriaValue(existing) };
    return intersectCriteriaValue(existing, value);
}

function addSimpleCriteria(out, key, value) {
    if (value === undefined || value === null) return true;
    const merged = mergeSimpleCriteria(out[key], value);
    if (!merged.valid) return false;
    out[key] = merged.value;
    return true;
}

function addGridCriteria(out, key, value) {
    if (value === undefined || value === null) return true;
    if (out[key] === undefined) {
        out[key] = cloneCriteriaValue(value);
        return true;
    }
    const merged = mergeGridCriteria(out[key], value);
    if (!merged.valid) return false;
    out[key] = merged.value;
    return true;
}

function mergeSequenceStepCriteria(a, b) {
    if (!a) return { valid: true, value: cloneCriteriaValue(b) };
    if (!b) return { valid: true, value: cloneCriteriaValue(a) };
    if (!criteriaKeysKnown(a, sequenceStepCriteriaKeys) || !criteriaKeysKnown(b, sequenceStepCriteriaKeys)) return { valid: false };
    const out = cloneCriteriaValue(a);
    const keys = Object.keys(b);
    for (let index = 0; index < keys.length; index++) {
        const key = keys[index];
        if (key === 'grid') {
            const merged = mergeGridCriteria(out.grid, b.grid);
            if (!merged.valid) return { valid: false };
            out.grid = merged.value;
        } else {
            const merged = mergeSimpleCriteria(out[key], b[key]);
            if (!merged.valid) return { valid: false };
            out[key] = merged.value;
        }
    }
    return { valid: true, value: out };
}

function mergeSequenceCriteria(existing, incoming) {
    if (existing === undefined || existing === null) return { valid: true, value: cloneCriteriaValue(incoming) };
    if (incoming === undefined || incoming === null) return { valid: true, value: cloneCriteriaValue(existing) };
    if (Array.isArray(existing) && isPlainObject(incoming)) {
        if (!criteriaKeysKnown(incoming, sequenceCriteriaKeys)) return { valid: false };
        const out = cloneCriteriaValue(incoming);
        if (out.steps !== undefined) return { valid: false };
        out.steps = cloneCriteriaValue(existing);
        return { valid: true, value: out };
    }
    if (Array.isArray(incoming) && isPlainObject(existing)) {
        if (!criteriaKeysKnown(existing, sequenceCriteriaKeys)) return { valid: false };
        const out = cloneCriteriaValue(existing);
        if (out.steps !== undefined) return { valid: false };
        out.steps = cloneCriteriaValue(incoming);
        return { valid: true, value: out };
    }
    if (!isPlainObject(existing) || !isPlainObject(incoming) || !criteriaKeysKnown(existing, sequenceCriteriaKeys) || !criteriaKeysKnown(incoming, sequenceCriteriaKeys)) return { valid: false };
    const out = cloneCriteriaValue(existing);
    const keys = Object.keys(incoming);
    for (let index = 0; index < keys.length; index++) {
        const key = keys[index];
        if (key === 'start' || key === 'end') {
            const merged = mergeSequenceStepCriteria(out[key], incoming[key]);
            if (!merged.valid) return { valid: false };
            out[key] = merged.value;
        } else if (out[key] === undefined) {
            out[key] = cloneCriteriaValue(incoming[key]);
        } else if (!criteriaValuesEqual(out[key], incoming[key])) {
            return { valid: false };
        }
    }
    return { valid: true, value: out };
}

function addSequenceCriteria(out, value) {
    const merged = mergeSequenceCriteria(out.sequence, value);
    if (!merged.valid) return false;
    out.sequence = merged.value;
    return true;
}

function addSequenceStartCriteria(out, key, value) {
    return addSequenceCriteria(out, { start: { [key]: value } });
}

function normalizeCriteria(criteria) {
    if (criteria === undefined || criteria === null) return null;
    if (isInvalidCriteria(criteria)) return invalidCriteria;
    if (!criteriaKeysKnown(criteria, criteriaKeys)) return invalidCriteria;

    const out = {};
    const keys = Object.keys(criteria);
    for (let index = 0; index < keys.length; index++) {
        const key = keys[index];
        const value = criteria[key];

        if (key === 'region' || key === 'area') {
            const normalized = normalizePhaseLocation(value);
            if (!normalized.valid) return invalidCriteria;
            const topKey = key;
            const startKey = key === 'region' ? 'startRegion' : 'startArea';
            const tapStartKey = key === 'region' ? 'tapStartRegion' : 'tapStartArea';
            if (!addSimpleCriteria(out, topKey, normalized.filters.current)) return invalidCriteria;
            if (!addSimpleCriteria(out, startKey, normalized.filters.start)) return invalidCriteria;
            if (!addSimpleCriteria(out, tapStartKey, normalized.filters.tapStart)) return invalidCriteria;
            if (normalized.filters.sequenceStart !== undefined && !addSequenceStartCriteria(out, key, normalized.filters.sequenceStart)) return invalidCriteria;
            continue;
        }

        if (key === 'grid') {
            const normalized = normalizeGridCriteria(value);
            if (!normalized.valid) return invalidCriteria;
            if (!addGridCriteria(out, 'grid', normalized.filters.grid)) return invalidCriteria;
            if (!addGridCriteria(out, 'startGrid', normalized.filters.startGrid)) return invalidCriteria;
            if (!addGridCriteria(out, 'tapStartGrid', normalized.filters.tapStartGrid)) return invalidCriteria;
            if (normalized.filters.sequenceStartGrid !== undefined && !addSequenceStartCriteria(out, 'grid', normalized.filters.sequenceStartGrid)) return invalidCriteria;
            continue;
        }

        if (key === 'startGrid' || key === 'tapStartGrid') {
            const normalized = normalizeLegacyGridCriteria(value);
            if (!normalized.valid || !addGridCriteria(out, key, normalized.value)) return invalidCriteria;
            continue;
        }

        if (key === 'sequenceStartGrid') {
            const normalized = normalizeLegacyGridCriteria(value);
            if (!normalized.valid || !addSequenceStartCriteria(out, 'grid', normalized.value)) return invalidCriteria;
            continue;
        }

        if (key === 'sequence') {
            if (!addSequenceCriteria(out, value)) return invalidCriteria;
            continue;
        }

        if (!addSimpleCriteria(out, key, value)) return invalidCriteria;
    }

    return out;
}

function gridMatchesNormalized(point, criteria) {
    const opt = isPlainObject(criteria) ? criteria : { cell: criteria };
    if (!gridObjectKeysKnown(opt) || !gridHasFilter(opt)) return false;
    const cell = gridFor(point, { rows: opt.rows || 3, cols: opt.cols || 3 });
    if (opt.index !== undefined && !matchValue(cell.index, opt.index)) return false;
    if (opt.row !== undefined && !matchValue(cell.row, opt.row)) return false;
    if (opt.col !== undefined && !matchValue(cell.col, opt.col)) return false;
    if (opt.cell !== undefined && !matchValue(gridCellName(cell), opt.cell)) return false;
    return true;
}

function gridMatches(point, criteria) {
    if (!point || criteria === undefined || criteria === null) return false;
    const normalized = normalizeLegacyGridCriteria(criteria);
    if (!normalized.valid) return false;
    if (Array.isArray(normalized.value)) return normalized.value.length > 0 && normalized.value.some(item => gridMatchesNormalized(point, item));
    return gridMatchesNormalized(point, normalized.value);
}

function tapStartPoint(event) {
    const taps = event && event.tapSequence && event.tapSequence.taps;
    return taps && taps[0] ? taps[0].center : null;
}
