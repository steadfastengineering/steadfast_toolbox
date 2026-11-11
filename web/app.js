const SVG_NS = "http://www.w3.org/2000/svg";
const FRAME_X = 0;
const OUTBOARD_X = 3;
const OUTBOARD_Y = 0;
const FRAME_COLOR = "#ff5c5c";
const AXLE_COLOR = "#39ff14";
const LINK_COLOR = "#c084fc";
const GRID_COLOR = "#14661f";

const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
const panels = Array.from(document.querySelectorAll('[role="tabpanel"]'));
const plot = document.getElementById("link-plot");
const plotTitle = document.getElementById("plot-title");
const thetaInput = document.querySelector('input[name="theta"]');
const forceInput = document.querySelector('input[name="force"]');
const results = document.getElementById("results");
const updateButton = document.getElementById("update-plot");
const linkError = document.getElementById("link-error");

let drawnTheta = 20;

function selectTab(next) {
  tabs.forEach((tab) => {
    const selected = tab === next;
    tab.setAttribute("aria-selected", selected ? "true" : "false");
    tab.tabIndex = selected ? 0 : -1;
  });
  panels.forEach((panel) => {
    panel.hidden = panel.id !== next.getAttribute("aria-controls");
  });
  next.focus();
}

tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectTab(tab));
  tab.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
      return;
    }
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const next = tabs[(index + direction + tabs.length) % tabs.length];
    selectTab(next);
  });
});

function svgEl(name, attrs, text) {
  const node = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function readLinkInputs() {
  const theta = Number(thetaInput.value.trim());
  const force = Number(forceInput.value.trim());
  const thetaValid = Number.isFinite(theta) && theta >= 0 && theta <= 90;
  const forceValid = Number.isFinite(force) && force > 0;
  if (!thetaValid || !forceValid) {
    return { valid: false, error: "Invalid input" };
  }
  return { valid: true, theta, force };
}

function formatLoad(value) {
  return String(Number(value.toPrecision(4)));
}

function computeLinkLoads(theta, force) {
  if (!Number.isFinite(theta) || !Number.isFinite(force) || Math.sin((theta * Math.PI) / 180) === 0) {
    return { isolated: 0, shared: 0 };
  }
  const isolated = force / Math.sin((theta * Math.PI) / 180);
  return { isolated, shared: isolated / 4 };
}

function showLinkResults(theta, force) {
  const loads = computeLinkLoads(theta, force);
  const isolatedText = formatLoad(loads.isolated);
  const sharedText = `${isolatedText} / 4 = ${formatLoad(loads.shared)}`;

  results.replaceChildren();
  [
    ["Single link load isolated (hypothetical)", isolatedText],
    ["Single link load in equal angle/length 4-link", sharedText],
  ].forEach(([label, value]) => {
    results.append(document.createElement("p"));
    results.lastChild.textContent = label;
    results.append(document.createElement("strong"));
    results.lastChild.textContent = value;
  });
}

function computeLinkGeometry(theta) {
  const meets = theta > 0;
  const frameY = meets
    ? OUTBOARD_Y + (OUTBOARD_X - FRAME_X) / Math.tan((theta * Math.PI) / 180)
    : null;
  return {
    meets,
    frameY,
    xMin: -1.6,
    xMax: OUTBOARD_X + 1,
    yBottom: -1,
    yTop: meets ? Math.max(frameY, OUTBOARD_Y) + 1 : 4,
  };
}

function drawLinkDiagram(theta) {
  const box = computeLinkGeometry(theta);
  const xMin = Math.floor(box.xMin);
  const xMax = Math.ceil(box.xMax);
  const yBot = Math.floor(box.yBottom);
  const yTop = Math.ceil(box.yTop);
  const width = xMax - xMin;
  const height = yTop - yBot;
  const point = (x, y) => ({
    x: x - xMin,
    y: yTop - y,
  });
  const pixelsWide = plot.clientWidth || 640;
  const unit = width / pixelsWide;
  const fontSize = Math.max(14 * unit, Math.min(width, height) * 0.042);

  plot.setAttribute("viewBox", `0 0 ${width} ${height}`);
  plot.replaceChildren();

  for (let x = xMin; x <= xMax; x += 1) {
    const from = point(x, yBot);
    const to = point(x, yTop);
    plot.append(svgEl("line", {
      x1: from.x, y1: from.y, x2: to.x, y2: to.y,
      stroke: GRID_COLOR, "stroke-width": 1, "vector-effect": "non-scaling-stroke",
    }));
  }
  for (let y = yBot; y <= yTop; y += 1) {
    const from = point(xMin, y);
    const to = point(xMax, y);
    plot.append(svgEl("line", {
      x1: from.x, y1: from.y, x2: to.x, y2: to.y,
      stroke: GRID_COLOR, "stroke-width": 1, "vector-effect": "non-scaling-stroke",
    }));
  }

  const frameTop = point(FRAME_X, yTop);
  const frameBottom = point(FRAME_X, yBot);
  plot.append(svgEl("line", {
    x1: frameTop.x, y1: frameTop.y, x2: frameBottom.x, y2: frameBottom.y,
    stroke: FRAME_COLOR, "stroke-width": 2, "vector-effect": "non-scaling-stroke",
  }));

  const axleLeft = point(xMin, 0);
  const axleRight = point(xMax, 0);
  plot.append(svgEl("line", {
    x1: axleLeft.x, y1: axleLeft.y, x2: axleRight.x, y2: axleRight.y,
    stroke: AXLE_COLOR, "stroke-width": 2, "vector-effect": "non-scaling-stroke",
  }));

  const frameLabel = point(FRAME_X - 0.18, (yBot + yTop) / 2);
  plot.append(svgEl("text", {
    x: frameLabel.x,
    y: frameLabel.y,
    fill: FRAME_COLOR,
    "font-size": fontSize,
    "font-family": "inherit",
    "text-anchor": "middle",
    "dominant-baseline": "middle",
    transform: `rotate(-90 ${frameLabel.x} ${frameLabel.y})`,
  }, "0° — Frame reference"));

  const axleLabel = point(OUTBOARD_X + 0.15, 0.28);
  plot.append(svgEl("text", {
    x: axleLabel.x,
    y: axleLabel.y,
    fill: AXLE_COLOR,
    "font-size": fontSize,
    "font-family": "inherit",
    "text-anchor": "start",
  }, "Axle"));

  if (box.meets) {
    const start = point(OUTBOARD_X, OUTBOARD_Y);
    const end = point(FRAME_X, box.frameY);
    plot.append(svgEl("line", {
      x1: start.x, y1: start.y, x2: end.x, y2: end.y,
      stroke: LINK_COLOR, "stroke-width": 2, "vector-effect": "non-scaling-stroke",
    }));
    drawArrow(start, end, 9 * unit, LINK_COLOR);
    plot.append(svgEl("circle", {
      cx: start.x, cy: start.y, r: 4 * unit, fill: LINK_COLOR,
    }));

    const rise = box.frameY - OUTBOARD_Y;
    const arcRadius = Math.min(1.4, 0.28 * Math.max(rise, 1));
    const arc = [];
    const steps = 24;
    for (let i = 0; i <= steps; i += 1) {
      const degrees = -90 + (theta * i) / steps;
      const radians = (degrees * Math.PI) / 180;
      arc.push(point(
        FRAME_X + arcRadius * Math.cos(radians),
        box.frameY + arcRadius * Math.sin(radians),
      ));
    }
    plot.append(svgEl("polyline", {
      points: arc.map((p) => `${p.x},${p.y}`).join(" "),
      fill: "none",
      stroke: "#39ff14",
      "stroke-width": 1.2,
      "vector-effect": "non-scaling-stroke",
    }));

    const labelAngle = ((-90 + theta / 2) * Math.PI) / 180;
    const label = point(
      FRAME_X + arcRadius * 1.55 * Math.cos(labelAngle),
      box.frameY + arcRadius * 1.55 * Math.sin(labelAngle),
    );
    plot.append(svgEl("text", {
      x: label.x,
      y: label.y,
      fill: "#39ff14",
      "font-size": fontSize,
      "font-family": "inherit",
      "text-anchor": "middle",
      "dominant-baseline": "middle",
    }, `${formatAngle(theta)}°`));
  } else {
    const top = point(OUTBOARD_X, box.yTop);
    const bottom = point(OUTBOARD_X, box.yBottom);
    plot.append(svgEl("line", {
      x1: top.x, y1: top.y, x2: bottom.x, y2: bottom.y,
      stroke: LINK_COLOR,
      "stroke-width": 2,
      "stroke-dasharray": "6 4",
      "vector-effect": "non-scaling-stroke",
    }));
    const note = point(OUTBOARD_X + 0.18, (yBot + yTop) / 2);
    plot.append(svgEl("text", {
      x: note.x,
      y: note.y,
      fill: LINK_COLOR,
      "font-size": fontSize * 0.85,
      "font-family": "inherit",
      "text-anchor": "middle",
      transform: `rotate(-90 ${note.x} ${note.y})`,
    }, "0° link does not meet the frame"));
  }

  const xLabel = point((xMin + xMax) / 2, yBot + 0.28);
  const yLabel = point(xMin + 0.2, (yBot + yTop) / 2);
  plot.append(svgEl("text", {
    x: xLabel.x, y: xLabel.y, fill: "#1f9a32", "font-size": fontSize * 0.85,
    "font-family": "inherit", "text-anchor": "middle",
  }, "Lateral"));
  plot.append(svgEl("text", {
    x: yLabel.x, y: yLabel.y, fill: "#1f9a32", "font-size": fontSize * 0.85,
    "font-family": "inherit", "text-anchor": "middle",
    transform: `rotate(-90 ${yLabel.x} ${yLabel.y})`,
  }, "Longitudinal"));

  plotTitle.textContent = `Top view | theta = ${formatAngle(theta)}° from frame`;
  drawnTheta = theta;
}

function drawArrow(from, to, size, color) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const tip = to;
  const left = {
    x: tip.x - size * Math.cos(angle - Math.PI / 7),
    y: tip.y - size * Math.sin(angle - Math.PI / 7),
  };
  const right = {
    x: tip.x - size * Math.cos(angle + Math.PI / 7),
    y: tip.y - size * Math.sin(angle + Math.PI / 7),
  };
  plot.append(svgEl("polygon", {
    points: `${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`,
    fill: color,
  }));
}

function formatAngle(theta) {
  return String(Number(theta.toFixed(4)));
}

function showInputError(el, message) {
  if (el) el.textContent = message;
}

function clearInputError(el) {
  if (el) el.textContent = "";
}

updateButton.addEventListener("click", () => {
  const input = readLinkInputs();
  if (!input.valid) {
    results.replaceChildren();
    showInputError(linkError, input.error);
    const thetaFallback = Number(thetaInput.value.trim());
    if (Number.isFinite(thetaFallback) && thetaFallback >= 0 && thetaFallback <= 90) {
      drawLinkDiagram(thetaFallback);
    }
    return;
  }
  clearInputError(linkError);
  drawLinkDiagram(input.theta);
  showLinkResults(input.theta, input.force);
});

window.addEventListener("resize", () => drawLinkDiagram(drawnTheta));
drawLinkDiagram(Number(thetaInput.value.trim()) || 20);
showLinkResults(null, null);

const sagittaPlot = document.getElementById("sagitta-plot");
const sagittaTitle = document.getElementById("sagitta-plot-title");
const sagittaRadiusInput = document.getElementById("sagitta-radius");
const sagittaChordInput = document.getElementById("sagitta-chord");
const sagittaResults = document.getElementById("sagitta-results");
const sagittaUpdate = document.getElementById("sagitta-update");
const sagittaError = document.getElementById("sagitta-error");

let drawnSagitta = { radius: 10, chord: 8 };

function readSagittaInputs() {
  const radius = Number(sagittaRadiusInput.value.trim());
  const chord = Number(sagittaChordInput.value.trim());
  const radiusValid = Number.isFinite(radius) && radius > 0 && radius <= 1e6;
  const chordValid = Number.isFinite(chord) && chord > 0 && chord <= radius * 2;
  if (!radiusValid || !chordValid) {
    return { valid: false, error: "Invalid input" };
  }
  return { valid: true, radius, chord };
}

function drawSagitta({ radius, chord }) {
  const half = chord / 2;
  const sagitta = radius - Math.sqrt(radius * radius - half * half);
  // Center sits off the chord so both chord endpoints lie on the circle.
  const centerX = sagitta - radius;
  const centerY = half;
  const pad = Math.max(radius, chord) * 0.1;
  let xMin = centerX;
  let xMax = sagitta + Math.max(radius * 0.42, pad * 3);
  let yMin = centerY - radius - pad;
  let yMax = centerY + radius + pad;

  // Expand to full grid squares so no row/column is clipped
  xMin = Math.floor(xMin);
  xMax = Math.ceil(xMax);
  yMin = Math.floor(yMin);
  yMax = Math.ceil(yMax);
  const width = xMax - xMin;
  const height = yMax - yMin;
  const point = (x, y) => ({ x: x - xMin, y: yMax - y });
  const pixelsWide = sagittaPlot.clientWidth || 640;
  const unit = width / pixelsWide;
  const fontSize = Math.max(14 * unit, Math.min(width, height) * 0.042);

  sagittaPlot.setAttribute("viewBox", `0 0 ${width} ${height}`);
  sagittaPlot.setAttribute("overflow", "hidden");
  sagittaPlot.replaceChildren();

  for (let x = Math.floor(xMin); x <= Math.ceil(xMax); x += 1) {
    const from = point(x, yMin);
    const to = point(x, yMax);
    sagittaPlot.append(svgEl("line", {
      x1: from.x, y1: from.y, x2: to.x, y2: to.y,
      stroke: GRID_COLOR, "stroke-width": 1, "vector-effect": "non-scaling-stroke",
    }));
  }
  for (let y = Math.floor(yMin); y <= Math.ceil(yMax); y += 1) {
    const from = point(xMin, y);
    const to = point(xMax, y);
    sagittaPlot.append(svgEl("line", {
      x1: from.x, y1: from.y, x2: to.x, y2: to.y,
      stroke: GRID_COLOR, "stroke-width": 1, "vector-effect": "non-scaling-stroke",
    }));
  }

  const center = point(centerX, centerY);
  const arcTip = point(sagitta, half);
  const arc = [];
  const arcSteps = 72;
  for (let i = 0; i <= arcSteps; i += 1) {
    const angle = -Math.PI / 2 + (Math.PI * i) / arcSteps;
    arc.push(point(
      centerX + radius * Math.cos(angle),
      centerY + radius * Math.sin(angle),
    ));
  }
  sagittaPlot.append(svgEl("polyline", {
    points: arc.map((p) => `${p.x},${p.y}`).join(" "),
    fill: "none",
    stroke: "#39ff14",
    "stroke-width": 2,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "vector-effect": "non-scaling-stroke",
  }));
  sagittaPlot.append(svgEl("line", {
    x1: center.x, y1: center.y, x2: arcTip.x, y2: arcTip.y,
    stroke: "#00ffcc", "stroke-width": 1.2, "stroke-dasharray": "5 4",
    "vector-effect": "non-scaling-stroke",
  }));

  const chordStart = point(0, 0);
  const chordEnd = point(0, chord);
  sagittaPlot.append(svgEl("line", {
    x1: chordStart.x, y1: chordStart.y, x2: chordEnd.x, y2: chordEnd.y,
    stroke: "#ff5c5c", "stroke-width": 2.2, "vector-effect": "non-scaling-stroke",
  }));
  [chordStart, chordEnd].forEach((p) => {
    sagittaPlot.append(svgEl("circle", {
      cx: p.x, cy: p.y, r: Math.max(3.2 * unit, fontSize * 0.16),
      fill: "#ff5c5c",
    }));
  });

  const sagStart = point(0, half);
  sagittaPlot.append(svgEl("line", {
    x1: sagStart.x, y1: sagStart.y, x2: arcTip.x, y2: arcTip.y,
    stroke: "#c084fc", "stroke-width": 2.4, "vector-effect": "non-scaling-stroke",
  }));
  appendPlotArrow(
    sagittaPlot,
    arcTip,
    0,
    Math.min(8 * unit, Math.max(sagitta * 0.35, 4 * unit)),
    "#c084fc",
  );
  sagittaPlot.append(svgEl("circle", {
    cx: center.x, cy: center.y, r: Math.max(3.5 * unit, fontSize * 0.18),
    fill: "#39ff14",
  }));

  const radiusLabel = point(centerX + (sagitta - centerX) * 0.38, half + fontSize * 1.7);
  sagittaPlot.append(svgEl("text", {
    x: radiusLabel.x,
    y: radiusLabel.y,
    fill: "#39ff14",
    "font-size": fontSize,
    "font-family": "inherit",
    "text-anchor": "middle",
  }, "Radius (Link Length)"));

  const chordLabel = point(-fontSize * 1.15, chord * 0.78);
  sagittaPlot.append(svgEl("text", {
    x: chordLabel.x,
    y: chordLabel.y,
    fill: "#ff5c5c",
    "font-size": fontSize,
    "font-family": "inherit",
    "text-anchor": "middle",
    "dominant-baseline": "middle",
    transform: `rotate(-90 ${chordLabel.x} ${chordLabel.y})`,
  }, "Chord"));

  const sagLabel = point(sagitta + fontSize * 0.7, half);
  sagittaPlot.append(svgEl("text", {
    x: sagLabel.x,
    y: sagLabel.y,
    fill: "#c084fc",
    "font-size": fontSize,
    "font-family": "inherit",
    "dominant-baseline": "middle",
  }, "sagitta"));

  sagittaTitle.textContent = `Sagitta | radius = ${formatLoad(radius)}`;
  drawnSagitta = { radius, chord };
}

function computeSagitta(radius, chord) {
  return radius - Math.sqrt(radius * radius - (chord / 2) * (chord / 2));
}

function updateSagitta() {
  const input = readSagittaInputs();
  if (!input.valid) {
    sagittaResults.replaceChildren();
    sagittaResults.append(document.createElement("p"));
    sagittaResults.lastChild.textContent = "Sagitta (arc height)";
    sagittaResults.append(document.createElement("strong"));
    sagittaResults.lastChild.textContent = "0.00";
    showInputError(sagittaError, input.error);
    return;
  }
  clearInputError(sagittaError);
  const sagitta = computeSagitta(input.radius, input.chord);
  drawSagitta({ radius: input.radius, chord: input.chord });

  sagittaResults.replaceChildren();
  ["Sagitta (arc height)"].forEach((label) => {
    sagittaResults.append(document.createElement("p"));
    sagittaResults.lastChild.textContent = label;
    sagittaResults.append(document.createElement("strong"));
    sagittaResults.lastChild.textContent = formatLoad(sagitta);
  });
}

sagittaUpdate.addEventListener("click", updateSagitta);

drawSagitta(drawnSagitta);
sagittaResults.replaceChildren();
sagittaResults.append(document.createElement("p"));
sagittaResults.lastChild.textContent = "Sagitta (arc height)";
sagittaResults.append(document.createElement("strong"));
sagittaResults.lastChild.textContent = "0.00";

const springInputsContainer = document.getElementById("spring-inputs");
const springAngleInput = document.getElementById("spring-angle");
const springUpdateButton = document.getElementById("spring-update");
const springError = document.getElementById("spring-error");
const springResults = document.getElementById("spring-results");
const springPlot = document.getElementById("spring-plot");
const springPlotTitle = document.getElementById("spring-plot-title");

function getSpringRates() {
  return Array.from(springInputsContainer.querySelectorAll(".spring-rate"))
    .map((input) => Number(input.value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function readAngle() {
  const value = Number(springAngleInput.value.trim());
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(46, value));
}

function computeSeriesRate(rates) {
  if (!rates.length) return null;
  let sum = 0;
  for (const k of rates) {
    sum += 1 / k;
  }
  return 1 / sum;
}

function updateSpringRate() {
  const rates = getSpringRates();
  const seriesRate = computeSeriesRate(rates);
  const angle = readAngle();
  springResults.replaceChildren();

  if (seriesRate === null) {
    showSpringResultsZero();
    return;
  }

  const radians = (angle * Math.PI) / 180;
  const cosTheta = Math.cos(radians);
  const cosSquared = cosTheta * cosTheta;

  // Axial force for a 1000 lb vertical load (static analysis)
  const axialForce = 1000 / cosTheta;

  // Effective vertical rate the vehicle feels
  const effectiveVerticalRate = seriesRate * cosSquared;

  [
    ["Combined spring rate (series)", seriesRate],
    ["Axial force @ 1000 lb vertical load", axialForce],
    ["Effective vertical rate (vehicle)", effectiveVerticalRate],
  ].forEach(([label, value]) => {
    springResults.append(document.createElement("p"));
    springResults.lastChild.textContent = label;
    springResults.append(document.createElement("strong"));
    springResults.lastChild.textContent = formatLoad(value);
  });
}

function showSpringResultsZero() {
  springResults.replaceChildren();
  [
    ["Combined spring rate (series)", "0"],
    ["Axial force @ 1000 lb vertical load", "0"],
    ["Effective vertical rate (vehicle)", "0"],
  ].forEach(([label, value]) => {
    springResults.append(document.createElement("p"));
    springResults.lastChild.textContent = label;
    springResults.append(document.createElement("strong"));
    springResults.lastChild.textContent = value;
  });
}

function rotatePoint(pt, cx, cy, radians) {
    const dx = pt.x - cx;
    const dy = pt.y - cy;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return {
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos
    };
  }

  function createSpringPoints(cx, topY, bottomY, width, numCoils) {
    const halfW = width / 2;
    const left = cx - halfW;
    const right = cx + halfW;
    const height = bottomY - topY;
    const coilH = height / (numCoils * 2);
    const pts = [];
    pts.push({ x: left + 0.3, y: topY });
    pts.push({ x: right - 0.3, y: topY });
    let y = topY;
    for (let i = 0; i < numCoils; i++) {
      y += coilH;
      pts.push({ x: left, y: y });
      y += coilH;
      pts.push({ x: right, y: y });
    }
    pts.push({ x: right - 0.3, y: bottomY });
    pts.push({ x: left + 0.3, y: bottomY });
    return pts;
  }

  function drawSpringPlot(angle) {
    const width = 4;
    const height = 6;
    const centerX = 2;
    const centerY = 3;
    const radians = (angle * Math.PI) / 180;

    springPlot.setAttribute("viewBox", `0 0 ${width} ${height}`);
    springPlot.replaceChildren();

    // Spring 1 (top) - taller, nearly touching spring 2
    const spring1Raw = createSpringPoints(2, 0.85, 2.95, 2.8, 3);
    const spring1 = spring1Raw.map((p) => rotatePoint(p, centerX, centerY, radians));
    springPlot.append(svgEl("polyline", {
      points: spring1.map((p) => `${p.x},${p.y}`).join(" "),
      fill: "none",
      stroke: "#00ffcc",
      "stroke-width": 0.035,
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
    }));

    // Spring 2 (bottom) - taller, nearly touching spring 1
    const spring2Raw = createSpringPoints(2, 3.05, 5.15, 2.8, 3);
    const spring2 = spring2Raw.map((p) => rotatePoint(p, centerX, centerY, radians));
    springPlot.append(svgEl("polyline", {
      points: spring2.map((p) => `${p.x},${p.y}`).join(" "),
      fill: "none",
      stroke: "#39ff14",
      "stroke-width": 0.035,
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
    }));

    // Spring axis through center
    const vectorLength = 4.8;
    const dx = Math.sin(radians) * (vectorLength / 2);
    const dy = Math.cos(radians) * (vectorLength / 2);
    const vStart = rotatePoint({ x: centerX, y: centerY - vectorLength / 2 }, centerX, centerY, radians);
    const vEnd = rotatePoint({ x: centerX, y: centerY + vectorLength / 2 }, centerX, centerY, radians);

    springPlot.append(svgEl("line", {
      x1: vStart.x, y1: vStart.y, x2: vEnd.x, y2: vEnd.y,
      stroke: "#c084fc", "stroke-width": 0.045,
    }));

    const arrowSize = 0.16;
    springPlot.append(svgEl("text", {
      x: vEnd.x + 0.12,
      y: vEnd.y,
      fill: "#c084fc",
      "font-size": 0.22,
      "font-family": "inherit",
      "dominant-baseline": "middle",
    }, "SPRING AXIS"));
    const angleRad = Math.atan2(vEnd.y - vStart.y, vEnd.x - vStart.x);
    const arrowX1 = vEnd.x - arrowSize * Math.cos(angleRad - 0.4);
    const arrowY1 = vEnd.y - arrowSize * Math.sin(angleRad - 0.4);
    const arrowX2 = vEnd.x - arrowSize * Math.cos(angleRad + 0.4);
    const arrowY2 = vEnd.y - arrowSize * Math.sin(angleRad + 0.4);

    springPlot.append(svgEl("polygon", {
      points: `${vEnd.x},${vEnd.y} ${arrowX1},${arrowY1} ${arrowX2},${arrowY2}`,
      fill: "#c084fc",
    }));

    springPlotTitle.textContent = `Angle = ${formatAngle(angle)}°`;
  }

springUpdateButton.addEventListener("click", () => {
    const rates = getSpringRates();
    if (!rates.length) {
      showInputError(springError, "Invalid input");
      showSpringResultsZero();
      return;
    }
    clearInputError(springError);
    updateSpringRate();
    const angle = readAngle();
    drawSpringPlot(angle);
  });

showSpringResultsZero();
drawSpringPlot(0);

const cogTrackInput = document.getElementById("cog-track");
const cogWheelbaseInput = document.getElementById("cog-wheelbase");
const cogLrInput = document.getElementById("cog-lr");
const cogRrInput = document.getElementById("cog-rr");
const cogLfInput = document.getElementById("cog-lf");
const cogRfInput = document.getElementById("cog-rf");
const cogUpdateButton = document.getElementById("cog-update");
const cogError = document.getElementById("cog-error");
const cogResults = document.getElementById("cog-results");
const cogPlot = document.getElementById("cog-plot");
const cogPlotTitle = document.getElementById("cog-plot-title");

function readPositive(input, max = 1e6) {
  const value = Number(input.value.trim());
  return Number.isFinite(value) && value > 0 && value <= max ? value : null;
}
function readNonNegative(input, max = 1e6) {
  const value = Number(input.value.trim());
  return Number.isFinite(value) && value >= 0 && value <= max ? value : null;
}

function readCogInputs() {
  const track = readPositive(cogTrackInput, 2000);
  const wheelbase = readPositive(cogWheelbaseInput, 3000);
  const lr = readNonNegative(cogLrInput, 20000);
  const rr = readNonNegative(cogRrInput, 20000);
  const lf = readNonNegative(cogLfInput, 20000);
  const rf = readNonNegative(cogRfInput, 20000);
  if (track === null || wheelbase === null || lr === null || rr === null || lf === null || rf === null) {
    return null;
  }
  const total = lr + rr + lf + rf;
  if (total <= 0) {
    return null;
  }
  return { track, wheelbase, lr, rr, lf, rf, total };
}

function computeCog({ track, wheelbase, lr, rr, lf, rf, total }) {
  const x = (track * rr + track * rf) / total;
  const y = (wheelbase * lf + wheelbase * rf) / total;
  return { x, y };
}

function showCogResults(cog) {
  cogResults.replaceChildren();
  [
    ["COG X (from left rear)", cog ? formatLoad(cog.x) : "0"],
    ["COG Y (from left rear)", cog ? formatLoad(cog.y) : "0"],
  ].forEach(([label, value]) => {
    cogResults.append(document.createElement("p"));
    cogResults.lastChild.textContent = label;
    cogResults.append(document.createElement("strong"));
    cogResults.lastChild.textContent = value;
  });
}

function drawCog(inputs, cog) {
  const track = inputs ? inputs.track : 60;
  const wheelbase = inputs ? inputs.wheelbase : 100;
  const x = cog ? cog.x : track / 2;
  const y = cog ? cog.y : wheelbase / 2;
  // Base geometry bounds
  let xMin = 0;
  let xMax = track;
  let yMin = 0;
  let yMax = wheelbase;

  // Add margin for labels (tires + COG text on right, frame on left)
  const labelPad = Math.max(track, wheelbase) * 0.20 + 32;
  xMin -= labelPad;
  xMax += labelPad + 8;
  yMin -= labelPad * 0.75;
  yMax += labelPad * 0.75;

  // Snap to full grid squares
  xMin = Math.floor(xMin);
  xMax = Math.ceil(xMax);
  yMin = Math.floor(yMin);
  yMax = Math.ceil(yMax);
  const width = xMax - xMin;
  const height = yMax - yMin;
  const point = (px, py) => ({ x: px - xMin, y: yMax - py });
  const pixelsWide = cogPlot.clientWidth || 640;
  const unit = width / pixelsWide;
  const fontSize = Math.max(14 * unit, Math.min(width, height) * 0.045);
  const tireR = Math.min(track, wheelbase) * 0.035;

  cogPlot.setAttribute("viewBox", `0 0 ${width} ${height}`);
  cogPlot.replaceChildren();

  for (let gx = Math.floor(xMin); gx <= Math.ceil(xMax); gx += Math.max(1, Math.round(track / 6))) {
    const from = point(gx, yMin);
    const to = point(gx, yMax);
    cogPlot.append(svgEl("line", {
      x1: from.x, y1: from.y, x2: to.x, y2: to.y,
      stroke: GRID_COLOR, "stroke-width": 1, "vector-effect": "non-scaling-stroke",
    }));
  }
  for (let gy = Math.floor(yMin); gy <= Math.ceil(yMax); gy += Math.max(1, Math.round(wheelbase / 6))) {
    const from = point(xMin, gy);
    const to = point(xMax, gy);
    cogPlot.append(svgEl("line", {
      x1: from.x, y1: from.y, x2: to.x, y2: to.y,
      stroke: GRID_COLOR, "stroke-width": 1, "vector-effect": "non-scaling-stroke",
    }));
  }

  const outline = [
    point(0, 0), point(track, 0), point(track, wheelbase), point(0, wheelbase),
  ];
  cogPlot.append(svgEl("polygon", {
    points: outline.map((p) => `${p.x},${p.y}`).join(" "),
    fill: "none",
    stroke: "#00ffff",
    "stroke-width": 1.6,
    "vector-effect": "non-scaling-stroke",
  }));

  const midX = point(track / 2, 0);
  const midXTop = point(track / 2, wheelbase);
  const midY = point(0, wheelbase / 2);
  const midYRight = point(track, wheelbase / 2);
  cogPlot.append(svgEl("line", {
    x1: midX.x, y1: midX.y, x2: midXTop.x, y2: midXTop.y,
    stroke: "#00ffff", "stroke-width": 1.4, "stroke-dasharray": "5 4",
    opacity: "0.45", "vector-effect": "non-scaling-stroke",
  }));
  cogPlot.append(svgEl("line", {
    x1: midY.x, y1: midY.y, x2: midYRight.x, y2: midYRight.y,
    stroke: "#00ffff", "stroke-width": 1.4, "stroke-dasharray": "5 4",
    opacity: "0.45", "vector-effect": "non-scaling-stroke",
  }));

  [
    [0, 0, "LR"],
    [track, 0, "RR"],
    [0, wheelbase, "LF"],
    [track, wheelbase, "RF"],
  ].forEach(([tx, ty, label]) => {
    const p = point(tx, ty);
    cogPlot.append(svgEl("circle", {
      cx: p.x, cy: p.y, r: tireR, fill: "#ff5c5c",
    }));
    cogPlot.append(svgEl("text", {
      x: p.x + tireR * 1.4,
      y: p.y - tireR * 0.6,
      fill: "#ff5c5c",
      "font-size": fontSize * 0.75,
      "font-family": "inherit",
    }, label));
  });

  const cogPoint = point(x, y);
  const arm = tireR * 2.2;
  cogPlot.append(svgEl("line", {
    x1: cogPoint.x - arm, y1: cogPoint.y, x2: cogPoint.x + arm, y2: cogPoint.y,
    stroke: "#39ff14", "stroke-width": 2, "vector-effect": "non-scaling-stroke",
  }));
  cogPlot.append(svgEl("line", {
    x1: cogPoint.x, y1: cogPoint.y - arm, x2: cogPoint.x, y2: cogPoint.y + arm,
    stroke: "#39ff14", "stroke-width": 2, "vector-effect": "non-scaling-stroke",
  }));
  cogPlot.append(svgEl("circle", {
    cx: cogPoint.x, cy: cogPoint.y, r: tireR * 0.55, fill: "#39ff14",
  }));
  cogPlot.append(svgEl("text", {
    x: cogPoint.x + arm * 1.15,
    y: cogPoint.y - arm * 0.35,
    fill: "#39ff14",
    "font-size": fontSize,
    "font-family": "inherit",
  }, "COG"));

  cogPlotTitle.textContent = cog
    ? `Top view | COG ${formatLoad(x)}, ${formatLoad(y)}`
    : "Top view | COG";
}

function updateCog() {
  const inputs = readCogInputs();
  if (!inputs) {
    showCogResults(null);
    drawCog(null, null);
    showInputError(cogError, "Invalid input");
    return;
  }
  clearInputError(cogError);
  const cog = computeCog(inputs);
  showCogResults(cog);
  drawCog(inputs, cog);
}

cogUpdateButton.addEventListener("click", updateCog);
showCogResults(null);
drawCog(null, null);

const tireWidthInput = document.getElementById("tire-width");
const tireAspectInput = document.getElementById("tire-aspect");
const tireRimInput = document.getElementById("tire-rim");
const tireUpdateButton = document.getElementById("tire-update");
const tireError = document.getElementById("tire-error");
const tireResults = document.getElementById("tire-results");
const tirePlot = document.getElementById("tire-plot");
const tirePlotTitle = document.getElementById("tire-plot-title");

function readTireInputs() {
  const width = Number(tireWidthInput.value.trim());
  const aspect = Number(tireAspectInput.value.trim());
  const rim = Number(tireRimInput.value.trim());
  if (!Number.isFinite(width) || width < 100 || width > 500) return null;
  if (!Number.isFinite(aspect) || aspect < 20 || aspect > 100) return null;
  if (!Number.isFinite(rim) || rim < 8 || rim > 24) return null;
  return { width, aspect, rim };
}

function computeTire({ width, aspect, rim }) {
  const stdWidth = width / 25.4;
  const sidewall = (width * (aspect / 100)) / 25.4;
  const diameter = 2 * (rim / 2 + sidewall);
  return { stdWidth, diameter, sidewall, rim };
}

function showTireResults(t) {
  tireResults.replaceChildren();
  if (!t) {
    ["Metric", "Imperial"].forEach((label) => {
      tireResults.append(document.createElement("p"));
      tireResults.lastChild.textContent = label;
      tireResults.append(document.createElement("strong"));
      tireResults.lastChild.textContent = "0";
    });
    return;
  }
  tireResults.append(document.createElement("p"));
  tireResults.lastChild.textContent = `Metric: ${t.width} ${t.aspect} R${t.rim}`;
  tireResults.append(document.createElement("strong"));
  tireResults.lastChild.textContent = `${formatLoad(t.stdWidth)} × ${formatLoad(t.diameter)}`;
}

function drawTire(t) {
  const viewH = 140;
  const margin = viewH * 0.16;
  const size = viewH;
  const step = size / 8;
  const px = (x) => x + margin;
  const py = (y) => size - (y + margin);
  const scale = size * 0.034;

  tirePlot.setAttribute("viewBox", `0 0 ${size} ${size}`);
  tirePlot.replaceChildren();

  for (let gx = 0; gx <= size; gx += step) {
    tirePlot.append(svgEl("line", {
      x1: gx, y1: 0, x2: gx, y2: size,
      stroke: GRID_COLOR, "stroke-width": 0.4, "vector-effect": "non-scaling-stroke",
    }));
  }
  for (let gy = 0; gy <= size; gy += step) {
    tirePlot.append(svgEl("line", {
      x1: 0, y1: gy, x2: size, y2: gy,
      stroke: GRID_COLOR, "stroke-width": 0.4, "vector-effect": "non-scaling-stroke",
    }));
  }

  tirePlot.append(svgEl("line", {
    x1: 0, y1: py(0), x2: size, y2: py(0),
    stroke: "#14661f", "stroke-width": 0.7,
  }));

  if (!t) {
    return;
  }

  const diameter = t.diameter;
  const width = t.stdWidth;
  const scaleDraw = 2.1;
  const halfH = (diameter / 2) * scaleDraw;
  const halfW = (width / 2) * scaleDraw;
  const depth = Math.max(width * 0.55, diameter * 0.18) * scaleDraw;
  const ground = 12;
  // Center the tire more symmetrically in the viewBox
  const cx = size / 2 - margin * 0.6;
  const botY = ground;
  const topY = ground + halfH * 2;
  const cy = (topY + botY) / 2;
  const frontX = cx - halfW;
  const backX = cx + halfW - 4;
  const rimHalfW = halfW * 0.62;
  const rimHalfH = (t.rim / 2) * scaleDraw;

  // Far sidewall: clipped ellipse, hidden behind the tire face
  tirePlot.append(svgEl("path", {
    d: `M ${px(backX)} ${py(topY)} A ${depth} ${halfH} 0 0 1 ${px(backX)} ${py(botY)}`,
    fill: "none",
    stroke: "#00ffff",
    "stroke-width": 0.7,
    opacity: "0.55",
  }));

  // Near sidewall: full ellipse
  tirePlot.append(svgEl("ellipse", {
    cx: px(frontX), cy: py(cy),
    rx: depth * 0.55, ry: halfH,
    fill: "none",
    stroke: "#00ffff",
    "stroke-width": 0.85,
  }));

  // Equal horizontal top and bottom
  tirePlot.append(svgEl("line", {
    x1: px(frontX), y1: py(topY), x2: px(backX), y2: py(topY),
    stroke: "#00ffff", "stroke-width": 0.8,
  }));
  tirePlot.append(svgEl("line", {
    x1: px(frontX), y1: py(botY), x2: px(backX), y2: py(botY),
    stroke: "#00ffff", "stroke-width": 0.8,
  }));

  // Rim on the near face
  tirePlot.append(svgEl("ellipse", {
    cx: px(frontX), cy: py(cy),
    rx: rimHalfW * 0.35, ry: rimHalfH,
    fill: "none",
    stroke: "#00ffff", "stroke-width": 0.65,
  }));
  tirePlot.append(svgEl("ellipse", {
    cx: px(frontX), cy: py(cy),
    rx: rimHalfW * 0.18, ry: rimHalfH * 0.55,
    fill: "none",
    stroke: "#00ffff", "stroke-width": 0.55,
  }));

  // Sparse tread marks centered on the tread band (between the two ellipse arcs)
  const treadCount = 15;
  for (let i = 0; i < treadCount; i++) {
    const y = botY + ((topY - botY) * (i + 0.5)) / treadCount;
    const span = Math.sqrt(Math.max(0, 1 - Math.pow((y - cy) / halfH, 2)));
    const nearRight = frontX + depth * 0.55 * span;
    const farLeft = backX - depth * span;
    const mid = (nearRight + farLeft) / 2;
    const treadLen = (farLeft - nearRight) * 0.72;
    tirePlot.append(svgEl("line", {
      x1: px(mid - treadLen / 2), y1: py(y), x2: px(mid + treadLen / 2), y2: py(y),
      stroke: "#39ff14", "stroke-width": 0.45,
    }));
  }

  // Place DIA dimension on the left so it stays inside the viewBox
  const dimX = px(frontX - depth * 0.75) - 8;
  tirePlot.append(svgEl("line", {
    x1: dimX, y1: py(topY), x2: dimX, y2: py(botY),
    stroke: "#00ffcc", "stroke-width": 0.55,
  }));
  tirePlot.append(svgEl("text", {
    x: dimX - 1.6,
    y: py(cy),
    fill: "#00ffcc",
    "font-size": scale * 1.2,
    "font-family": "inherit",
    "text-anchor": "end",
    "dominant-baseline": "middle",
  }, `DIA ${formatLoad(diameter)}″`));

  const dimY = py(topY) - 4;
  tirePlot.append(svgEl("line", {
    x1: px(frontX), y1: dimY, x2: px(backX), y2: dimY,
    stroke: "#00ffcc", "stroke-width": 0.55,
  }));
  tirePlot.append(svgEl("text", {
    x: px((frontX + backX) / 2),
    y: dimY - 1.8,
    fill: "#00ffcc",
    "font-size": scale * 1.0,
    "font-family": "inherit",
    "text-anchor": "middle",
  }, `WIDTH ${formatLoad(t.width)} mm / ${formatLoad(width)}″`));
}

function updateTire() {
  const inputs = readTireInputs();
  if (!inputs) {
    showTireResults(null);
    drawTire(null);
    showInputError(tireError, "Invalid input");
    return;
  }
  clearInputError(tireError);
  const tire = computeTire(inputs);
  showTireResults({ ...inputs, ...tire });
  drawTire({ ...inputs, ...tire });
}

tireUpdateButton.addEventListener("click", updateTire);

// Render a default tire on first load (same pattern as other tabs)
{
  const def = { width: 255, aspect: 85, rim: 16 };
  const tire = computeTire(def);
  showTireResults({ ...def, ...tire });
  drawTire({ ...def, ...tire });
}

const crawlTrans = document.getElementById("crawl-trans");
const crawlR1 = document.getElementById("crawl-r1");
const crawlR2 = document.getElementById("crawl-r2");
const crawlR3 = document.getElementById("crawl-r3");
const crawlDiff = document.getElementById("crawl-diff");
const crawlPortal = document.getElementById("crawl-portal");
const crawlTorque = document.getElementById("crawl-torque");
const crawlDiameter = document.getElementById("crawl-diameter");
const crawlUpdate = document.getElementById("crawl-update");
const crawlError = document.getElementById("crawl-error");
const crawlResults = document.getElementById("crawl-results");
const crawlPlot = document.getElementById("crawl-plot");
const crawlPlotTitle = document.getElementById("crawl-plot-title");

function readCrawlRatio() {
  const vals = [
    crawlTrans, crawlR1, crawlR2, crawlR3, crawlDiff, crawlPortal
  ].map((el) => {
    const v = Number(el.value.trim());
    return Number.isFinite(v) && v > 0 ? v : 1;
  });
  return vals;
}

function readInputTorque() {
  const v = Number(crawlTorque.value.trim());
  return Number.isFinite(v) && v > 0 && v <= 2000 ? v : 110;
}
function readTireDiameter() {
  const v = Number(crawlDiameter.value.trim());
  return Number.isFinite(v) && v >= 20 && v <= 60 ? v : 33;
}

function computeTireForce(outTorque, diameter) {
  return outTorque * 24 / diameter;
}

function computeCrawlRatio(vals) {
  return vals.reduce((a, b) => a * b, 1);
}

function computeCrawlData(ratios, inputTorque, diameter) {
  const ratio = computeCrawlRatio(ratios);
  const outTorque = inputTorque * ratio;
  const tireForce = outTorque * 24 / diameter;
  return { ratio, outTorque, tireForce };
}

function showCrawlResults(ratio, outTorque, tireForce) {
  crawlResults.replaceChildren();
  [
    ["Crawl Ratio", ratio],
    ["Output Torque (ft-lbs)", outTorque],
    ["Tire Force (lbf)", tireForce],
  ].forEach(([label, value]) => {
    crawlResults.append(document.createElement("p"));
    crawlResults.lastChild.textContent = label;
    crawlResults.append(document.createElement("strong"));
    crawlResults.lastChild.textContent = formatLoad(value);
  });
}

function appendPlotArrow(parent, tip, angle, size, color) {
  const left = {
    x: tip.x - size * Math.cos(angle - 0.45),
    y: tip.y - size * Math.sin(angle - 0.45),
  };
  const right = {
    x: tip.x - size * Math.cos(angle + 0.45),
    y: tip.y - size * Math.sin(angle + 0.45),
  };
  parent.append(svgEl("polygon", {
    points: `${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`,
    fill: color,
  }));
}

function drawCrawlRatioChain(svg, vals) {
  const viewW = 520;
  const labels = ["Trans", "R1", "R2", "R3", "Diff", "Portal"];
  const boxW = 62;
  const gap = 14;
  const chainW = labels.length * boxW + (labels.length - 1) * gap;
  const startX = (viewW - chainW) / 2;
  const y = 58;

  vals.forEach((v, i) => {
    const x = startX + i * (boxW + gap);
    svg.append(svgEl("rect", {
      x, y: y - 22, width: boxW, height: 44,
      fill: "none", stroke: "#00ffff", "stroke-width": 1.1,
    }));
    svg.append(svgEl("text", {
      x: x + boxW / 2, y: y - 6,
      fill: "#00ffcc", "font-size": 12,
      "font-family": "inherit", "text-anchor": "middle",
    }, labels[i]));
    svg.append(svgEl("text", {
      x: x + boxW / 2, y: y + 12,
      fill: "#39ff14", "font-size": 13,
      "font-family": "inherit", "text-anchor": "middle",
    }, formatLoad(v)));

    if (i < vals.length - 1) {
      svg.append(svgEl("line", {
        x1: x + boxW + 2, y1: y, x2: x + boxW + gap - 2, y2: y,
        stroke: "#00ffff", "stroke-width": 1,
      }));
    }
  });
}

function drawTireDiagram(svg, outTorque, tireForce) {
  const cx = 175;
  const cy = 250;
  const radius = 88;
  const groundY = cy + radius;

  svg.append(svgEl("line", {
    x1: 24, y1: groundY, x2: 496, y2: groundY,
    stroke: "#14661f", "stroke-width": 1.4,
  }));

  svg.append(svgEl("circle", {
    cx, cy, r: radius,
    fill: "none", stroke: "#00ffff", "stroke-width": 1.6,
  }));
  svg.append(svgEl("circle", {
    cx, cy, r: 3.2, fill: "#00ffcc",
  }));

  const turns = 1.35;
  const steps = 72;
  const r0 = 14;
  const r1 = 42;
  const spiral = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const angle = -Math.PI / 2 - t * turns * Math.PI * 2;
    const r = r0 + (r1 - r0) * t;
    spiral.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
  }
  svg.append(svgEl("polyline", {
    points: spiral.map((p) => `${p.x},${p.y}`).join(" "),
    fill: "none",
    stroke: "#00ffcc",
    "stroke-width": 1.6,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  }));
  const tip = spiral[spiral.length - 1];
  const prev = spiral[spiral.length - 2];
  appendPlotArrow(svg, tip, Math.atan2(tip.y - prev.y, tip.x - prev.x), 11, "#00ffcc");

  svg.append(svgEl("text", {
    x: cx + radius + 22,
    y: cy - 16,
    fill: "#00ffcc",
    "font-size": 15,
    "font-family": "inherit",
  }, "OUTPUT TORQUE"));
  svg.append(svgEl("text", {
    x: cx + radius + 22,
    y: cy + 8,
    fill: "#39ff14",
    "font-size": 16,
    "font-family": "inherit",
  }, `${formatLoad(outTorque)} ft-lbs`));

  const forceEnd = { x: cx + 118, y: groundY };
  svg.append(svgEl("line", {
    x1: cx, y1: groundY, x2: forceEnd.x, y2: forceEnd.y,
    stroke: "#39ff14", "stroke-width": 2.2,
  }));
  appendPlotArrow(svg, forceEnd, 0, 12, "#39ff14");
  svg.append(svgEl("text", {
    x: forceEnd.x + 14,
    y: groundY - 8,
    fill: "#39ff14",
    "font-size": 15,
    "font-family": "inherit",
  }, "TIRE FORCE"));
  svg.append(svgEl("text", {
    x: forceEnd.x + 14,
    y: groundY + 14,
    fill: "#39ff14",
    "font-size": 16,
    "font-family": "inherit",
  }, `${formatLoad(tireForce)} lbf`));
}

function drawCrawlDiagram(svg, vals, outTorque, tireForce) {
  const viewW = 520;
  const viewH = 440;
  svg.setAttribute("viewBox", `0 0 ${viewW} ${viewH}`);
  svg.replaceChildren();

  const step = 40;
  for (let gx = 0; gx <= viewW; gx += step) {
    svg.append(svgEl("line", {
      x1: gx, y1: 0, x2: gx, y2: viewH,
      stroke: GRID_COLOR, "stroke-width": 1, "vector-effect": "non-scaling-stroke",
    }));
  }
  for (let gy = 0; gy <= viewH; gy += step) {
    svg.append(svgEl("line", {
      x1: 0, y1: gy, x2: viewW, y2: gy,
      stroke: GRID_COLOR, "stroke-width": 1, "vector-effect": "non-scaling-stroke",
    }));
  }

  drawCrawlRatioChain(svg, vals);
  drawTireDiagram(svg, outTorque, tireForce);
}

function readCrawlInputs() {
  const ratios = readCrawlRatio();
  const torque = readInputTorque();
  const diameter = readTireDiameter();

  const rawTorque = Number(crawlTorque.value.trim());
  const rawDiameter = Number(crawlDiameter.value.trim());

  const torqueValid = Number.isFinite(rawTorque) && rawTorque > 0 && rawTorque <= 2000;
  const diameterValid = Number.isFinite(rawDiameter) && rawDiameter >= 20 && rawDiameter <= 60;

  if (!torqueValid || !diameterValid) {
    return { valid: false, error: "Invalid input" };
  }

  return { valid: true, ratios, torque, diameter };
}

function updateCrawl() {
  const input = readCrawlInputs();

  if (!input.valid) {
    showInputError(crawlError, input.error);
    return;
  }

  clearInputError(crawlError);

  const { ratio, outTorque, tireForce } = computeCrawlData(input.ratios, input.torque, input.diameter);

  showCrawlResults(ratio, outTorque, tireForce);
  drawCrawlDiagram(crawlPlot, input.ratios, outTorque, tireForce);
  crawlPlotTitle.textContent = `Crawl ${formatLoad(ratio)} | Torque ${formatLoad(outTorque)} ft-lbs | Force ${formatLoad(tireForce)} lbf`;
}

crawlUpdate.addEventListener("click", updateCrawl);

// Initial render
updateCrawl();

const fastenerDiameter = document.getElementById("fastener-diameter");
const fastenerTensile = document.getElementById("fastener-tensile");
const fastenerUpdate = document.getElementById("fastener-update");
const fastenerError = document.getElementById("fastener-error");
const fastenerResults = document.getElementById("fastener-results");

function readFastenerInputs() {
  const diameter = Number(fastenerDiameter.value.trim());
  const tensile = Number(fastenerTensile.value.trim());
  const diameterValid = Number.isFinite(diameter) && diameter > 0 && diameter <= 4;
  const tensileValid = Number.isFinite(tensile) && tensile > 0 && tensile <= 500000;
  if (!diameterValid || !tensileValid) {
    return { valid: false, error: "Invalid input" };
  }
  return { valid: true, diameter, tensile };
}

function computeFastenerShear(diameter, tensile) {
  const shearStrength = tensile / Math.sqrt(3);
  const area = Math.PI * (diameter / 2) ** 2;
  const singleShear = shearStrength * area;
  const doubleShear = 2 * singleShear;
  return { shearStrength, area, singleShear, doubleShear };
}

function showFastenerResults(data) {
  fastenerResults.replaceChildren();
  [
    ["Shear strength (psi)", data ? formatLoad(data.shearStrength) : "0"],
    ["Shank area (in²)", data ? formatLoad(data.area) : "0"],
    ["Single shear capacity (lbf)", data ? formatLoad(data.singleShear) : "0"],
    ["Double shear capacity (lbf)", data ? formatLoad(data.doubleShear) : "0"],
  ].forEach(([label, value]) => {
    fastenerResults.append(document.createElement("p"));
    fastenerResults.lastChild.textContent = label;
    fastenerResults.append(document.createElement("strong"));
    fastenerResults.lastChild.textContent = value;
  });
}

function updateFastener() {
  const input = readFastenerInputs();
  if (!input.valid) {
    showFastenerResults(null);
    showInputError(fastenerError, input.error);
    return;
  }
  clearInputError(fastenerError);
  showFastenerResults(computeFastenerShear(input.diameter, input.tensile));
}

fastenerUpdate.addEventListener("click", updateFastener);
updateFastener();
