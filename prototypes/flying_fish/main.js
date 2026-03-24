// Tuna Imports Visualization - Sankey and Chord Diagrams
// Data: bluefin_tuna_imports.csv

// Color scheme by continent
const continentColors = {
  "AFRICA": "#FF6B6B",
  "ASIA": "#FFA500",
  "EUROPE": "#4ECDC4",
  "NORTH AMERICA": "#95E1D3",
  "OCEANIA": "#F38181",
  "SOUTH AMERICA": "#AA96DA"
};

// Set up dimensions
const margin = { top: 20, right: 200, bottom: 40, left: 200 };
const width = 1500 - margin.left - margin.right - 400;
const height = 900 - margin.top - margin.bottom;

// State
let currentView = "sankey";
let currentYear = 2025;

// Create tooltip
const tooltip = d3
  .select("body")
  .append("div")
  .style("position", "absolute")
  .style("background-color", "white")
  .style("border", "1px solid #ccc")
  .style("border-radius", "4px")
  .style("padding", "8px 12px")
  .style("font-size", "12px")
  .style("pointer-events", "none")
  .style("opacity", 0)
  .style("z-index", 1000)
  .style("box-shadow", "0 2px 8px rgba(0,0,0,0.15)");

// Create SVG
const svg = d3
  .select("#viz")
  .append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

// Load and process data
d3.csv("../../datasets/bluefin_tuna_imports.csv").then(function(rawData) {
  // Get unique years and set slider range
  const allYears = Array.from(new Set(rawData.map(d => parseInt(d.Year)))).sort((a, b) => a - b);
  const minYear = allYears[0];
  const maxYear = allYears[allYears.length - 1];
  
  d3.select("#yearSlider")
    .attr("min", minYear)
    .attr("max", maxYear)
    .attr("value", 2025);
  
  // Function to render Sankey diagram
  function renderSankey(data, countryContinent, sortedCountries, districts, nodeIndices, links, nodes) {
    svg.selectAll("*").remove();
    
    // Create Sankey layout
    const sankey = d3
      .sankey()
      .nodeWidth(15)
      .nodePadding(10)
      .extent([
        [0, 0],
        [width, height]
      ]);

    const graph = sankey({
      nodes: nodes.map(d => ({ ...d })),
      links: links.map(d => ({ ...d }))
    });

    // Color scale for links
    const linkColor = d => {
      return continentColors[d.source.continent] || "#999";
    };

    // Draw links
    svg
      .append("g")
      .selectAll("path")
      .data(graph.links)
      .enter()
      .append("path")
      .attr("d", d3.sankeyLinkHorizontal())
      .attr("stroke", linkColor)
      .attr("stroke-opacity", 0.4)
      .attr("fill", "none")
      .attr("stroke-width", d => Math.max(2, d.width))
      .style("cursor", "pointer")
      .on("mouseover", function(event, d) {
        d3.select(this)
          .attr("stroke-opacity", 1)
        
        const sourceName = d.source.name;
        const targetName = d.target.name;
        const volume = d.value.toLocaleString();
        const usdValue = Math.round(d.usdValue).toLocaleString();
        
        tooltip
          .style("opacity", 1)
          .html(`<strong>${sourceName} → ${targetName}</strong><br/>Volume: ${volume} kg<br/>Value: $${usdValue} USD`)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mousemove", function(event) {
        tooltip
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", function() {
        d3.select(this)
          .attr("stroke-opacity", 0.4);
        
        tooltip.style("opacity", 0);
      });

    // Draw nodes
    const node = svg
      .append("g")
      .selectAll("g")
      .data(graph.nodes)
      .enter()
      .append("g")
      .attr("transform", d => `translate(${d.x0},${d.y0})`);

    node
      .append("rect")
      .attr("width", d => d.x1 - d.x0)
      .attr("height", d => d.y1 - d.y0)
      .attr("fill", d => {
        if (d.type === "country") {
          return continentColors[d.continent] || "#999";
        } else {
          return "#cccccc";
        }
      })
      .attr("stroke", "#000");

    // Add labels
    node
      .append("text")
      .attr("x", d => (d.type === "country" ? -(d.x0 === 0 ? 6 : 6) : d.x1 - d.x0 + 6))
      .attr("y", d => (d.y1 - d.y0) / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", d => (d.type === "country" ? "end" : "start"))
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .text(d => d.name);
  }

  // Function to render Directed Chord diagram
  function renderChord(data, countryContinent, sortedCountries, sortedDistricts) {
    svg.selectAll("*").remove();

    const chordSize = Math.min(width, height);
    const innerRadius = chordSize * 0.35;
    const outerRadius = innerRadius + 20;

    // Create list of all nodes (countries + districts)
    const countryList = Array.from(sortedCountries);
    const districtList = Array.from(sortedDistricts);
    const names = [...countryList, ...districtList];
    const index = new Map(names.map((name, i) => [name, i]));

    // Create matrix: rows = countries, cols = districts (non-square)
    const matrix = Array.from(index, () => new Array(names.length).fill(0));
    const usdMatrix = Array.from(index, () => new Array(names.length).fill(0));

    // Populate matrix with volume and USD data (countries -> districts)
    data.forEach(d => {
      const source = index.get(d["Country Name"]);
      const target = index.get(d["US Customs District"]);
      if (source !== undefined && target !== undefined) {
        matrix[source][target] += parseFloat(d["Volume (kg)"]);
        usdMatrix[source][target] += parseFloat(d["Value (USD)"]);
      }
    });

    // Create directed chord layout
    const chord = d3.chordDirected()
      .padAngle(12 / innerRadius)
      .sortSubgroups(d3.descending);

    const arc = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius);

    const ribbon = d3.ribbonArrow()
      .radius(innerRadius - 1);

    const chords = chord(matrix);

    // Color mapping for nodes
    const nodeColors = {};
    countryList.forEach(country => {
      nodeColors[index.get(country)] = continentColors[countryContinent[country]] || "#999";
    });
    districtList.forEach(district => {
      nodeColors[index.get(district)] = "#cccccc";
    });

    // Create main group centered
    const chordSvg = svg
      .append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    // Draw ribbons with arrows
    chordSvg
      .append("g")
      .selectAll("path")
      .data(chords)
      .enter()
      .append("path")
      .attr("d", ribbon)
      .attr("fill", d => nodeColors[d.source.index])
      .attr("fill-opacity", 0.75)
      .attr("fill-rule", "nonzero")
      .attr("stroke", d => d3.rgb(nodeColors[d.source.index]).darker())
      .attr("stroke-width", 1.5)
      .style("cursor", "pointer")
      .on("mouseover", function(event, d) {
        d3.select(this)
          .attr("fill-opacity", 0.9);

        const sourceName = names[d.source.index];
        const targetName = names[d.target.index];
        const volume = d.source.value.toLocaleString();
        const usdValue = Math.round(usdMatrix[d.source.index][d.target.index]).toLocaleString();

        tooltip
          .style("opacity", 1)
          .html(`<strong>${sourceName} → ${targetName}</strong><br/>Volume: ${volume} kg<br/>Value: $${usdValue} USD`)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mousemove", function(event) {
        tooltip
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", function() {
        d3.select(this)
          .attr("fill-opacity", 1);

        tooltip.style("opacity", 0);
      });

    // Draw group arcs
    chordSvg
      .append("g")
      .selectAll("g")
      .data(chords.groups)
      .enter()
      .append("g")
      .append("path")
      .attr("d", arc)
      .attr("fill", d => nodeColors[d.index])
      .attr("fill-rule", "nonzero")
      .attr("stroke", d => d3.rgb(nodeColors[d.index]).darker())
      .attr("stroke-width", 1.5);

    // Add labels
    chordSvg
      .append("g")
      .selectAll("g")
      .data(chords.groups)
      .enter()
      .append("g")
      .attr("transform", d => `rotate(${(d.startAngle + d.endAngle) / 2 * 180 / Math.PI - 90})translate(${outerRadius + 30})`)
      .append("text")
      .attr("text-anchor", d => (d.startAngle + d.endAngle) / 2 > Math.PI ? "end" : null)
      .attr("transform", d => (d.startAngle + d.endAngle) / 2 > Math.PI ? "rotate(180)" : null)
      .style("font-size", "11px")
      .style("pointer-events", "none")
      .text(d => names[d.index]);
  }

  // Function to update visualization for a given year
  function updateVisualization(selectedYear) {
    // Filter data for selected year
    const data = rawData.filter(d => parseInt(d.Year) === selectedYear);
    currentYear = selectedYear;

    if (data.length === 0) {
      console.log(`No data for year ${selectedYear}`);
      return;
    }

    // Update year display
    d3.select("#yearDisplay").text(selectedYear);

    // Create nodes: countries on left, districts on right
    const countries = new Set(data.map(d => d["Country Name"]));
    const districts = new Set(data.map(d => d["US Customs District"]));

    // Store continent info for coloring
    const countryContinent = {};
    data.forEach(d => {
      countryContinent[d["Country Name"]] = d.Continent;
    });

    // Sort countries by continent
    const sortedCountries = Array.from(countries).sort((a, b) => {
      return countryContinent[a].localeCompare(countryContinent[b]);
    });

    // Sort districts alphabetically
    const sortedDistricts = Array.from(districts).sort();

    // Create nodes array for Sankey
    const nodes = [];
    const nodeIndices = {};
    let nodeId = 0;

    sortedCountries.forEach(country => {
      nodeIndices[country] = nodeId;
      nodes.push({
        id: nodeId,
        name: country,
        type: "country",
        continent: countryContinent[country]
      });
      nodeId++;
    });

    sortedDistricts.forEach(district => {
      nodeIndices[district] = nodeId;
      nodes.push({
        id: nodeId,
        name: district,
        type: "district"
      });
      nodeId++;
    });

    // Create links
    const links = [];
    data.forEach(d => {
      const source = nodeIndices[d["Country Name"]];
      const target = nodeIndices[d["US Customs District"]];
      const volume = parseFloat(d["Volume (kg)"]);
      const value = parseFloat(d["Value (USD)"]);

      const existingLink = links.find(
        l => l.source === source && l.target === target
      );

      if (existingLink) {
        existingLink.value += volume;
        existingLink.usdValue += value;
      } else {
        links.push({
          source: source,
          target: target,
          value: volume,
          usdValue: value
        });
      }
    });

    // Render based on current view
    if (currentView === "sankey") {
      renderSankey(data, countryContinent, sortedCountries, districts, nodeIndices, links, nodes);
    } else {
      renderChord(data, countryContinent, sortedCountries, sortedDistricts);
    }
  }

  // Initial render
  updateVisualization(2025);

  // Add slider event listener
  d3.select("#yearSlider").on("input", function() {
    const year = parseInt(this.value);
    updateVisualization(year);
  });

  // Add view toggle buttons
  d3.select("#sankeyBtn").on("click", function() {
    currentView = "sankey";
    d3.select("#sankeyBtn").classed("active", true);
    d3.select("#chordBtn").classed("active", false);
    updateVisualization(currentYear);
  });

  d3.select("#chordBtn").on("click", function() {
    currentView = "chord";
    d3.select("#sankeyBtn").classed("active", false);
    d3.select("#chordBtn").classed("active", true);
    updateVisualization(currentYear);
  });
});