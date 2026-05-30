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

function gridMatches(point, criteria) {
    if (!point || criteria === undefined || criteria === null) return false;
    if (Array.isArray(criteria)) return criteria.some(item => gridMatches(point, item));
    const opt = isPlainObject(criteria) ? criteria : { cell: criteria };
    const cell = gridFor(point, { rows: opt.rows || 3, cols: opt.cols || 3 });
    if (opt.index !== undefined && !matchValue(cell.index, opt.index)) return false;
    if (opt.row !== undefined && !matchValue(cell.row, opt.row)) return false;
    if (opt.col !== undefined && !matchValue(cell.col, opt.col)) return false;
    if (opt.cell !== undefined && !matchValue(gridCellName(cell), opt.cell)) return false;
    return true;
}

function tapStartPoint(event) {
    const taps = event && event.tapSequence && event.tapSequence.taps;
    return taps && taps[0] ? taps[0].center : null;
}
