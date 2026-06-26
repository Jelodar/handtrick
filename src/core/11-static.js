const criteriaKeys = listSet([
    'region',
    'startRegion',
    'tapStartRegion',
    'grid',
    'startGrid',
    'tapStartGrid',
    'sequenceStartGrid',
    'sequence',
    'area',
    'startArea',
    'tapStartArea',
    'edge',
    'modifierRegion',
    'modifierArea',
    'modifierSource',
    'modifierName',
    'modifierFingers',
    'actionFingers',
    'totalFingers',
    'key',
    'keys',
    'combo',
    'modifierKeys',
    'direction',
    'axis',
    'speed',
    'modified',
    'path',
    'pathText',
    'fingers',
    'actualFingers',
    'syntheticFingers',
    'fingerSource',
    'keyboardRole',
    'pointerType',
    'tapCount'
]);

const sequenceCriteriaKeys = listSet(['start', 'end', 'steps']);
const sequenceStepCriteriaKeys = listSet([
    'event',
    'gesture',
    'family',
    'mode',
    'state',
    'direction',
    'fingers',
    'actualFingers',
    'syntheticFingers',
    'fingerSource',
    'keyboardRole',
    'keys',
    'combo',
    'tapCount',
    'region',
    'grid',
    'area'
]);

function criteriaKeysKnown(criteria, allowed) {
    if (!isPlainObject(criteria)) return false;
    return Object.keys(criteria).every(key => allowed[key]);
}

function sequenceCriteriaMatches(event, expected) {
    const gestures = event && event.gestureSequence && event.gestureSequence.gestures;
    if (!gestures || !gestures.length) return false;
    if (Array.isArray(expected)) return expected.length > 0 && expected.every((criteria, index) => sequenceStepCriteriaMatches(gestures[index], criteria));
    if (!criteriaKeysKnown(expected, sequenceCriteriaKeys)) return false;
    if (expected.start && !sequenceStepCriteriaMatches(gestures[0], expected.start)) return false;
    if (expected.end && !sequenceStepCriteriaMatches(gestures[gestures.length - 1], expected.end)) return false;
    if (expected.steps !== undefined && !sequenceCriteriaMatches(event, expected.steps)) return false;
    return !!(expected.start || expected.end || expected.steps !== undefined);
}

function sequenceStepCriteriaMatches(step, criteria) {
    if (criteria === undefined || criteria === null) return true;
    if (!step || !criteriaKeysKnown(criteria, sequenceStepCriteriaKeys)) return false;
    if (criteria.event && !matchValue(step.event, criteria.event)) return false;
    if (criteria.gesture && !matchValue(step.gesture, criteria.gesture)) return false;
    if (criteria.family && !matchValue(step.family, criteria.family)) return false;
    if (criteria.mode && !matchValue(step.mode, criteria.mode)) return false;
    if (criteria.state && !matchValue(step.state, criteria.state)) return false;
    if (criteria.direction && !matchValue(step.direction, criteria.direction)) return false;
    if (criteria.fingers !== undefined && !matchValue(step.fingers, criteria.fingers)) return false;
    if (criteria.actualFingers !== undefined && !matchValue(step.actualFingers, criteria.actualFingers)) return false;
    if (criteria.syntheticFingers !== undefined && !matchValue(step.syntheticFingers, criteria.syntheticFingers)) return false;
    if (criteria.fingerSource !== undefined && criteria.fingerSource !== null && !matchFingerSource(step.fingerSource, criteria.fingerSource)) return false;
    if (criteria.keyboardRole && !matchValue(step.keyboardRole, criteria.keyboardRole)) return false;
    if (criteria.keys && !matchCombo(step.keyCombo, criteria.keys)) return false;
    if (criteria.combo && !matchCombo(step.keyCombo, criteria.combo)) return false;
    if (criteria.tapCount !== undefined && !matchValue(step.tapCount, criteria.tapCount)) return false;
    if (criteria.region && !HandTrick.region(step.center, criteria.region)) return false;
    if (criteria.grid && !gridMatches(step.center, criteria.grid)) return false;
    if (criteria.area && !matchValue(step.center && step.center.area, criteria.area)) return false;
    return true;
}

HandTrick.events = eventNames.slice();
HandTrick.recognizers = recognizerNames.slice();
HandTrick.families = Object.keys(eventRegistry).filter(group => group !== 'lifecycle');
HandTrick.groups = merge(eventRegistry);
HandTrick.region = function (event, region) {
    const point = event && event.center ? event.center : event;
    if (!point) return false;
    if (Array.isArray(region)) return region.some(item => HandTrick.region(point, item));
    if (region === 'any') return true;
    if (region === point.region) return true;
    if (region === point.zone || region === point.halfRegion || region === point.edgeRegion || region === point.area) return true;
    if (region === point.halfX || region === point.halfY || region === point.thirdX || region === point.thirdY) return true;
    if (region === 'edge') return !!(point.edge && (point.edge.top || point.edge.right || point.edge.bottom || point.edge.left));
    return !!(point.edge && point.edge[region]);
};
HandTrick.zone = function (point, options) {
    return gridFor(point, options);
};
HandTrick.path = function (value) {
    return pathPatternText(value);
};
HandTrick.matches = function (event, criteria) {
    if (!event) return false;
    if (criteria === undefined || criteria === null) return true;
    const opt = normalizeCriteria(criteria);
    if (isInvalidCriteria(opt)) return false;
    if (!opt) return true;
    const modifier = event.modifier || null;
    const modifierPoint = modifier && modifier.position ? modifier.position.source : null;
    const tapStart = tapStartPoint(event);
    if (opt.region && !HandTrick.region(event, opt.region)) return false;
    if (opt.startRegion && !HandTrick.region(event && event.startCenter, opt.startRegion)) return false;
    if (opt.tapStartRegion && !HandTrick.region(tapStart, opt.tapStartRegion)) return false;
    if (opt.grid && !gridMatches(event && event.center, opt.grid)) return false;
    if (opt.startGrid && !gridMatches(event && event.startCenter, opt.startGrid)) return false;
    if (opt.tapStartGrid && !gridMatches(tapStart, opt.tapStartGrid)) return false;
    if (opt.sequence && !sequenceCriteriaMatches(event, opt.sequence)) return false;
    if (opt.area && !matchValue(event.area, opt.area)) return false;
    if (opt.startArea && !matchValue(event.startArea, opt.startArea)) return false;
    if (opt.tapStartArea && !matchValue(tapStart && tapStart.area, opt.tapStartArea)) return false;
    if (opt.modifierRegion && !HandTrick.region(modifierPoint, opt.modifierRegion)) return false;
    if (opt.modifierArea && !matchValue(modifier && modifier.area, opt.modifierArea)) return false;
    if (opt.modifierSource && !matchValue(modifier && modifier.source, opt.modifierSource)) return false;
    if (opt.modifierName && !matchValue(modifier && modifier.name, opt.modifierName)) return false;
    if (opt.modifierFingers !== undefined && !matchValue(modifier && modifier.fingers, opt.modifierFingers)) return false;
    if (opt.actionFingers !== undefined && !matchValue(modifier && modifier.actionFingers, opt.actionFingers)) return false;
    if (opt.totalFingers !== undefined && !matchValue(modifier && modifier.totalFingers, opt.totalFingers)) return false;
    if (opt.key && !toArray(opt.key).every(key => (event.keys || []).includes(canonicalKey(key)))) return false;
    if (opt.keys && !matchCombo(event.keyCombo, opt.keys)) return false;
    if (opt.combo && !matchCombo(event.keyCombo, opt.combo)) return false;
    if (opt.modifierKeys && !matchCombo(modifier && modifier.keyCombo, opt.modifierKeys)) return false;
    if (opt.direction && !matchValue(event.direction, opt.direction)) return false;
    if (opt.axis && !matchValue(event.axis, opt.axis)) return false;
    if (opt.speed && !matchValue(event.speed, opt.speed)) return false;
    if (opt.modified !== undefined && !!event.modified !== !!opt.modified) return false;
    if (opt.path && !pathMatches(event.path || event.pathText, opt.path, event)) return false;
    if (opt.pathText && !pathMatches(event.path || event.pathText, opt.pathText, event)) return false;
    if (opt.fingers !== undefined && !matchValue(event.fingers, opt.fingers)) return false;
    if (opt.actualFingers !== undefined && !matchValue(event.actualFingers, opt.actualFingers)) return false;
    if (opt.syntheticFingers !== undefined && !matchValue(event.syntheticFingers, opt.syntheticFingers)) return false;
    if (opt.fingerSource !== undefined && opt.fingerSource !== null && !matchFingerSource(event.fingerSource, opt.fingerSource)) return false;
    if (opt.keyboardRole && !matchValue(event.keyboardSubstitute && event.keyboardSubstitute.role, opt.keyboardRole)) return false;
    if (opt.pointerType && !matchValue(event.pointerType, opt.pointerType)) return false;
    if (opt.tapCount !== undefined && !matchValue(event.tapCount, opt.tapCount)) return false;
    if (opt.edge && !HandTrick.region(event, opt.edge)) return false;
    return true;
};
HandTrick.presets = presetRegistry;
HandTrick.keyCombo = normalizeCombo;
HandTrick.event = function (value) {
    const key = canonicalEventType(value);
    if (key === '*') return '*';
    const path = pathPatternFromEvent(key);
    if (path) return path;
    const sequence = parseSequenceSelector(key);
    if (sequence.valid) return sequence.canonical;
    const parsed = parseEventSelector(key);
    return parsed.valid ? parsed.canonical : '';
};
HandTrick.isEvent = function (value) {
    return !!HandTrick.event(value);
};
