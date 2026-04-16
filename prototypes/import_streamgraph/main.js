// Dimensions and margins
const margin = { top: 40, right: 160, bottom: 60, left: 60 };
const width = document.getElementById('chart').clientWidth - margin.left - margin.right;
const height = document.getElementById('chart').clientHeight - margin.top - margin.bottom;

// Create SVG
const svg = d3.select('#chart')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

// Load and process data
d3.csv('data/noaa_import_tunas_bluefin.csv').then(data => {
    // Parse year as number and volume as number
    data.forEach(d => {
        d.Year = +d.Year;
        d['Volume (kg)'] = +d['Volume (kg)'];
    });

    // Filter data to only include years through 2025
    data = data.filter(d => d.Year <= 2025);

    // Aggregate data by Year and Country, summing volumes
    const aggregated = d3.rollup(
        data,
        v => d3.sum(v, d => d['Volume (kg)']),
        d => d.Year,
        d => d['Country Name']
    );

    // Convert to array format for D3 stack
    const years = Array.from(aggregated.keys()).sort((a, b) => a - b);
    const countries = Array.from(
        new Set(data.map(d => d['Country Name']))
    ).sort();

    // Create data structure for stacking
    const stackData = years.map(year => {
        const entry = { year };
        countries.forEach(country => {
            entry[country] = aggregated.get(year)?.get(country) || 0;
        });
        return entry;
    });

    // Create D3 stack generator with wiggle offset
    const stack = d3.stack()
        .keys(countries)
        .offset(d3.stackOffsetWiggle);

    const stackedData = stack(stackData);

    // Create scales
    const xScale = d3.scaleLinear()
        .domain([years[0], years[years.length - 1]])
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([
            d3.min(stackedData, d => d3.min(d, point => point[0])),
            d3.max(stackedData, d => d3.max(d, point => point[1]))
        ])
        .range([height, 0]);

    // Create color scale
    const colorScale = d3.scaleOrdinal()
        .domain(countries)
        .range(d3.schemeCategory10.concat(d3.schemePastel1).concat(d3.schemePastel2));

    // Custom color function: Japan is red, others use color scale
    const getColor = (country) => {
        return country === 'JAPAN' ? '#d32f2f' : colorScale(country);
    };

    // Create area generator
    const area = d3.area()
        .x(d => xScale(d.data.year))
        .y0(d => yScale(d[0]))
        .y1(d => yScale(d[1]));

    // Add streams
    svg.selectAll('.stream')
        .data(stackedData)
        .enter()
        .append('path')
        .attr('class', 'stream')
        .attr('d', area)
        .attr('fill', d => getColor(d.key))
        .attr('data-country', d => d.key)
        .on('mouseover', function(event, d) {
            const country = d.key;
            
            // Highlight current stream, dim others
            svg.selectAll('.stream')
                .classed('inactive', stream => stream.key !== country);
            
            // Show tooltip
            const tooltip = document.getElementById('tooltip');
            tooltip.style.display = 'block';
            tooltip.innerHTML = `
                <div class="tooltip-country">${country}</div>
                <div class="tooltip-data" id="tooltip-data"></div>
            `;
            
            // Position tooltip
            tooltip.style.left = (event.pageX + 10) + 'px';
            tooltip.style.top = (event.pageY - 10) + 'px';
            
            // Show volume for closest year on mousemove
            updateTooltipData(event, d, country);
        })
        .on('mousemove', function(event, d) {
            const tooltip = document.getElementById('tooltip');
            tooltip.style.left = (event.pageX + 10) + 'px';
            tooltip.style.top = (event.pageY - 10) + 'px';
            updateTooltipData(event, d);
        })
        .on('mouseout', function() {
            // Remove highlight
            svg.selectAll('.stream').classed('inactive', false);
            
            // Hide tooltip
            document.getElementById('tooltip').style.display = 'none';
        });

    function updateTooltipData(event, stackedSeries, country) {
        // Get mouse position relative to chart
        const chartRect = document.querySelector('svg').getBoundingClientRect();
        const chartX = event.clientX - chartRect.left - margin.left;
        
        // Find closest year
        const year = Math.round(xScale.invert(chartX));
        const yearData = stackData.find(d => d.year === year);
        
        if (yearData) {
            const volume = yearData[stackedSeries.key];
            const volumeFormatted = volume.toLocaleString('en-US', {
                maximumFractionDigits: 0
            });
            
            document.getElementById('tooltip-data').innerHTML = 
                `${year}: ${volumeFormatted} kg`;
        }
    }

    // Add X axis
    const xAxis = d3.axisBottom(xScale)
        .tickFormat(d3.format('d'));
    
    svg.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${height})`)
        .call(xAxis)
        .append('text')
        .attr('class', 'axis-label')
        .attr('x', width / 2)
        .attr('y', 50)
        .attr('text-anchor', 'middle')
        .text('Year');

    // Add Y axis
    const yAxis = d3.axisLeft(yScale)
        .tickFormat(d => d / 1000000 + 'M');
    
    svg.append('g')
        .attr('class', 'axis')
        .call(yAxis)
        .append('text')
        .attr('class', 'axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - margin.left + 15)
        .attr('x', 0 - (height / 2))
        .attr('text-anchor', 'middle')
        .text('Volume (kg)');

}).catch(error => {
    console.error('Error loading data:', error);
    document.getElementById('chart').innerHTML = '<p style="color: red; padding: 20px;">Error loading data. Check console for details.</p>';
});
