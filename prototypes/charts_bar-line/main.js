const chartEl = document.getElementById('chart');
const tooltipEl = document.getElementById('tooltip');
const dataSelectEl = document.getElementById('data-select');
const speciesFilterEl = document.getElementById('species-filter');
const toyosuPriceFilterEl = document.getElementById('toyosu-price-filter');
const subtitleEl = document.querySelector('.subtitle');

const GTA_DATA_PATH = 'data/GTA_FIRMs_tuna_cleaned_countries.csv';
const TOYOSU_DATA_PATH = 'data/toyosu_tuna_2023.csv';
const TOYOSU_0423_DATA_PATH = 'data/toyosu_tuna_04-23.csv';
const TOYOSU_MULTILINE = 'toyosu_multiline';
const ALLOWED_GTA_SPECIES = new Set(['SBF', 'BFT', 'PBF']);

// Dimensions and margins
const margin = { top: 40, right: 160, bottom: 60, left: 60 };

function normalizeStreamRow(row) {
    if (row.Year !== undefined && row['Volume (kg)'] !== undefined) {
        return {
            Year: +row.Year,
            Country: row['Country Name'],
            VolumeKg: +row['Volume (kg)'],
            Species: null
        };
    }

    return {
        Year: +row.year,
        Country: row.country,
        VolumeKg: +row.measurement_value,   
        Species: row.species ? String(row.species).toUpperCase() : ''
    };
}

function normalizeToyosuRow(row) {
    return {
        weekNumber: +row.week_number,
        priceHigh: +row.price_high,
        priceMid: +row.price_mid,
        priceLow: +row.price_low
    };
}

function updateControlState(csvPath) {
    const isGtaDataset = csvPath === GTA_DATA_PATH;
    const isToyosuDataset = csvPath === TOYOSU_DATA_PATH || csvPath === TOYOSU_0423_DATA_PATH;
    const isToyosuMultiline = csvPath === TOYOSU_MULTILINE;
    speciesFilterEl.disabled = !isGtaDataset;
    toyosuPriceFilterEl.disabled = !isToyosuDataset;

    if (!isGtaDataset) {
        speciesFilterEl.checked = false;
    }

    if (!isToyosuDataset) {
        toyosuPriceFilterEl.checked = false;
    }

    if (subtitleEl) {
        if (isToyosuMultiline) {
            subtitleEl.textContent = 'Mid price (yen) by week, each year overlaid (2004-2023)';
        } else if (isToyosuDataset) {
            subtitleEl.textContent = csvPath === TOYOSU_0423_DATA_PATH
                ? 'Price (yen) by week, 2004-2023'
                : 'Price (yen) by week, 2023';
        } else {
            subtitleEl.textContent = 'Volume (kg) by Country, 1989-2026';
        }
    }
}

function renderToyosuLineChart(csvPath) {
    chartEl.innerHTML = '';
    tooltipEl.style.display = 'none';

    const width = chartEl.clientWidth - margin.left - margin.right;
    const height = chartEl.clientHeight - margin.top - margin.bottom;

    const svg = d3.select('#chart')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    d3.csv(csvPath).then(rawData => {
        const data = rawData
            .map(normalizeToyosuRow)
            .filter(d => Number.isFinite(d.weekNumber) && Number.isFinite(d.priceHigh) && Number.isFinite(d.priceMid) && Number.isFinite(d.priceLow))
            .sort((a, b) => a.weekNumber - b.weekNumber);

        const filteredData = toyosuPriceFilterEl.checked
            ? data.filter(d => d.priceHigh <= 20000 && d.priceMid <= 20000 && d.priceLow <= 20000)
            : data;

        if (!filteredData.length) {
            chartEl.innerHTML = '<p style="color: #444; padding: 20px;">No data available for this source.</p>';
            return;
        }

        const xScale = d3.scaleLinear()
            .domain(d3.extent(filteredData, d => d.weekNumber))
            .range([0, width]);

        const yScale = d3.scaleLinear()
            .domain([
                d3.min(filteredData, d => d.priceLow),
                d3.max(filteredData, d => d.priceHigh)
            ])
            .nice()
            .range([height, 0]);

        const lineSeries = [
            { key: 'priceHigh', label: 'price_high', color: '#d1495b' },
            { key: 'priceMid', label: 'price_mid', color: '#1d4ed8' },
            { key: 'priceLow', label: 'price_low', color: '#15803d' }
        ];

        const shadedArea = d3.area()
            .x(d => xScale(d.weekNumber))
            .y0(d => yScale(d.priceLow))
            .y1(d => yScale(d.priceHigh))
            .curve(d3.curveMonotoneX);

        const lineGenerator = key => d3.line()
            .x(d => xScale(d.weekNumber))
            .y(d => yScale(d[key]))
            .curve(d3.curveMonotoneX);

        svg.append('path')
            .datum(filteredData)
            .attr('class', 'price-area')
            .attr('d', shadedArea)
            .attr('fill', 'rgba(33, 37, 41, 0.08)');

        svg.selectAll('.price-line')
            .data(lineSeries)
            .enter()
            .append('path')
            .attr('class', 'price-line')
            .attr('d', d => lineGenerator(d.key)(filteredData))
            .attr('fill', 'none')
            .attr('stroke', d => d.color)
            .attr('stroke-width', 2.5)
            .attr('stroke-linecap', 'round')
            .attr('stroke-linejoin', 'round');

        const legend = svg.append('g')
            .attr('class', 'line-legend')
            .attr('transform', `translate(${width - 120}, 0)`);

        lineSeries.forEach((series, index) => {
            const row = legend.append('g')
                .attr('transform', `translate(0, ${index * 18})`);

            row.append('rect')
                .attr('width', 10)
                .attr('height', 10)
                .attr('rx', 2)
                .attr('fill', series.color);

            row.append('text')
                .attr('x', 14)
                .attr('y', 9)
                .attr('font-size', 11)
                .attr('fill', '#333')
                .text(series.label);
        });

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
            .text('Week Number');

        const yAxis = d3.axisLeft(yScale)
            .tickFormat(d => `¥${d3.format(',')(d)}`);

        svg.append('g')
            .attr('class', 'axis')
            .call(yAxis)
            .append('text')
            .attr('class', 'axis-label')
            .attr('transform', 'rotate(-90)')
            .attr('y', 0 - margin.left + 15)
            .attr('x', 0 - (height / 2))
            .attr('text-anchor', 'middle')
            .text('Yen');

        const bisectWeek = d3.bisector(d => d.weekNumber).center;
        const overlay = svg.append('rect')
            .attr('class', 'tooltip-overlay')
            .attr('width', width)
            .attr('height', height)
            .attr('fill', 'transparent')
            .style('cursor', 'crosshair');

        overlay
            .on('mouseover', function(event) {
                tooltipEl.style.display = 'block';
                updateTooltip(event);
            })
            .on('mousemove', function(event) {
                updateTooltip(event);
            })
            .on('mouseout', function() {
                tooltipEl.style.display = 'none';
            });

        function updateTooltip(event) {
            const svgRect = d3.select('#chart svg').node().getBoundingClientRect();
            const chartX = Math.max(0, Math.min(width, event.clientX - svgRect.left - margin.left));
            const hoveredWeek = xScale.invert(chartX);
            const index = bisectWeek(filteredData, hoveredWeek);
            const datum = filteredData[Math.max(0, Math.min(filteredData.length - 1, index))];

            if (!datum) {
                return;
            }

            tooltipEl.style.left = (event.pageX + 10) + 'px';
            tooltipEl.style.top = (event.pageY - 10) + 'px';
            tooltipEl.innerHTML = `
                <div class="tooltip-country">Week ${datum.weekNumber}</div>
                <div class="tooltip-data">High: ¥${d3.format(',')(datum.priceHigh)}</div>
                <div class="tooltip-data">Mid: ¥${d3.format(',')(datum.priceMid)}</div>
                <div class="tooltip-data">Low: ¥${d3.format(',')(datum.priceLow)}</div>
            `;
        }
    }).catch(error => {
        console.error('Error loading data:', error);
        chartEl.innerHTML = '<p style="color: red; padding: 20px;">Error loading data. Check console for details.</p>';
    });
}

function renderToyosuMultiLineChart(csvPath) {
    chartEl.innerHTML = '';
    tooltipEl.style.display = 'none';

    const width = chartEl.clientWidth - margin.left - margin.right;
    const height = chartEl.clientHeight - margin.top - margin.bottom;

    const svg = d3.select('#chart')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    d3.csv(TOYOSU_0423_DATA_PATH).then(rawData => {
        const data = rawData
            .map(row => ({
                year: +row.year,
                month: +row.month,
                week: +row.week,
                priceMid: +row.price_mid
            }))
            .filter(d => Number.isFinite(d.year) && Number.isFinite(d.month) && Number.isFinite(d.week) && Number.isFinite(d.priceMid));

        if (!data.length) {
            chartEl.innerHTML = '<p style="color: #444; padding: 20px;">No data available for this source.</p>';
            return;
        }

        // Group data by year, then calculate week within year
        const yearGroups = d3.group(data, d => d.year);
        const years = Array.from(yearGroups.keys()).sort((a, b) => a - b);

        // Normalize data to have weekInYear (1-52) for each year
        const normalizedData = [];
        years.forEach(year => {
            const yearData = yearGroups.get(year);
            yearData.forEach((d, index) => {
                normalizedData.push({
                    year: d.year,
                    weekInYear: index + 1,  // Week position within the year (1, 2, 3, ...)
                    priceMid: d.priceMid
                });
            });
        });

        // Regroup normalized data by year
        const normalizedYearGroups = d3.group(normalizedData, d => d.year);

        // Create scales
        const xScale = d3.scaleLinear()
            .domain([1, 52])
            .range([0, width]);

        const yScale = d3.scaleLinear()
            .domain([
                d3.min(normalizedData, d => d.priceMid),
                d3.max(normalizedData, d => d.priceMid)
            ])
            .nice()
            .range([height, 0]);

        // Color scale for years
        const colorScale = d3.scaleOrdinal()
            .domain(years)
            .range(d3.schemeCategory10);

        const lineGenerator = d3.line()
            .x(d => xScale(d.weekInYear))
            .y(d => yScale(d.priceMid))
            .curve(d3.curveMonotoneX);

        // Create a group for each year
        const yearLines = svg.selectAll('.year-line')
            .data(years)
            .enter()
            .append('g')
            .attr('class', 'year-line')
            .attr('data-year', d => d);

        // Add path for each year
        yearLines.append('path')
            .attr('class', 'line')
            .attr('d', year => lineGenerator(normalizedYearGroups.get(year)))
            .attr('stroke', year => colorScale(year))
            .attr('stroke-width', 2)
            .attr('fill', 'none')
            .attr('stroke-linecap', 'round')
            .attr('stroke-linejoin', 'round');

        // Add interactive overlay for each year
        yearLines.append('path')
            .attr('class', 'line-overlay')
            .attr('d', year => lineGenerator(normalizedYearGroups.get(year)))
            .attr('stroke', 'transparent')
            .attr('stroke-width', 12)
            .attr('fill', 'none')
            .attr('pointer-events', 'stroke')
            .on('mouseover', function(event, year) {
                // Highlight the hovered year
                svg.selectAll('.year-line .line')
                    .attr('stroke-opacity', yearLine => yearLine === year ? 1 : 0.15)
                    .attr('stroke-width', yearLine => yearLine === year ? 3.5 : 2);

                // Highlight in legend
                svg.selectAll('.legend-item').classed('highlighted', d => d === year);

                // Show tooltip
                tooltipEl.style.display = 'block';
                tooltipEl.innerHTML = `<div class="tooltip-country">${year}</div>`;
                tooltipEl.style.left = (event.pageX + 10) + 'px';
                tooltipEl.style.top = (event.pageY - 10) + 'px';
            })
            .on('mousemove', function(event) {
                tooltipEl.style.left = (event.pageX + 10) + 'px';
                tooltipEl.style.top = (event.pageY - 10) + 'px';
            })
            .on('mouseout', function() {
                // Remove highlight
                svg.selectAll('.year-line .line')
                    .attr('stroke-opacity', 1)
                    .attr('stroke-width', 2);

                svg.selectAll('.legend-item').classed('highlighted', false);
                tooltipEl.style.display = 'none';
            });

        // Legend
        const legend = svg.append('g')
            .attr('class', 'line-legend')
            .attr('transform', `translate(${width + 30}, 0)`);

        const legendItems = legend.selectAll('.legend-item')
            .data(years)
            .enter()
            .append('g')
            .attr('class', 'legend-item')
            .attr('transform', (d, i) => `translate(0, ${i * 18})`)
            .on('mouseover', function(event, year) {
                // Highlight the line
                svg.selectAll('.year-line .line')
                    .attr('stroke-opacity', yearLine => yearLine === year ? 1 : 0.15)
                    .attr('stroke-width', yearLine => yearLine === year ? 3.5 : 2);

                // Highlight this legend item
                d3.select(this).classed('highlighted', true);

                // Show tooltip
                tooltipEl.style.display = 'block';
                tooltipEl.innerHTML = `<div class="tooltip-country">${year}</div>`;
                tooltipEl.style.left = (event.pageX + 10) + 'px';
                tooltipEl.style.top = (event.pageY - 10) + 'px';
            })
            .on('mousemove', function(event) {
                tooltipEl.style.left = (event.pageX + 10) + 'px';
                tooltipEl.style.top = (event.pageY - 10) + 'px';
            })
            .on('mouseout', function() {
                // Remove highlight
                svg.selectAll('.year-line .line')
                    .attr('stroke-opacity', 1)
                    .attr('stroke-width', 2);

                d3.select(this).classed('highlighted', false);
                tooltipEl.style.display = 'none';
            });

        legendItems.append('line')
            .attr('x1', 0)
            .attr('x2', 10)
            .attr('y1', -5)
            .attr('y2', -5)
            .attr('stroke', year => colorScale(year))
            .attr('stroke-width', 2);

        legendItems.append('text')
            .attr('x', 14)
            .attr('y', 0)
            .attr('font-size', 11)
            .attr('fill', '#333')
            .text(year => year)

        // Axes
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
            .text('Week Number');

        const yAxis = d3.axisLeft(yScale)
            .tickFormat(d => `¥${d3.format(',')(d)}`);

        svg.append('g')
            .attr('class', 'axis')
            .call(yAxis)
            .append('text')
            .attr('class', 'axis-label')
            .attr('transform', 'rotate(-90)')
            .attr('y', 0 - margin.left + 15)
            .attr('x', 0 - (height / 2))
            .attr('text-anchor', 'middle')
            .text('Mid Price (yen)');
    }).catch(error => {
        console.error('Error loading data:', error);
        chartEl.innerHTML = '<p style="color: red; padding: 20px;">Error loading data. Check console for details.</p>';
    });
}

function renderChart(csvPath) {
    chartEl.innerHTML = '';
    tooltipEl.style.display = 'none';
    updateControlState(csvPath);

    if (csvPath === TOYOSU_MULTILINE) {
        renderToyosuMultiLineChart(csvPath);
        return;
    }

    if (csvPath === TOYOSU_DATA_PATH || csvPath === TOYOSU_0423_DATA_PATH) {
        renderToyosuLineChart(csvPath);
        return;
    }

    const width = chartEl.clientWidth - margin.left - margin.right;
    const height = chartEl.clientHeight - margin.top - margin.bottom;

    const svg = d3.select('#chart')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    d3.csv(csvPath).then(rawData => {
        let data = rawData
            .map(normalizeStreamRow)
            .filter(d => Number.isFinite(d.Year) && Number.isFinite(d.VolumeKg) && d.Country)
            .filter(d => d.Year <= 2025);

        if (csvPath === GTA_DATA_PATH && speciesFilterEl.checked) {
            data = data.filter(d => ALLOWED_GTA_SPECIES.has(d.Species));
        }

        if (!data.length) {
            chartEl.innerHTML = '<p style="color: #444; padding: 20px;">No data available for this source.</p>';
            return;
        }

        // Aggregate data by Year and Country, summing volumes
        const aggregated = d3.rollup(
            data,
            v => d3.sum(v, d => d.VolumeKg),
            d => d.Year,
            d => d.Country
        );

        // Convert to array format for D3 stack
        const years = Array.from(aggregated.keys()).sort((a, b) => a - b);
        const countries = Array.from(new Set(data.map(d => d.Country))).sort();

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

        // Keep the original color logic and styling behavior.
        const colorScale = d3.scaleOrdinal()
            .domain(countries)
            .range(d3.schemeCategory10.concat(d3.schemePastel1).concat(d3.schemePastel2));

        const getColor = country => (
            String(country).toUpperCase() === 'JAPAN' ? '#d32f2f' : colorScale(country)
        );

        const area = d3.area()
            .x(d => xScale(d.data.year))
            .y0(d => yScale(d[0]))
            .y1(d => yScale(d[1]));

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

                svg.selectAll('.stream')
                    .classed('inactive', stream => stream.key !== country);

                tooltipEl.style.display = 'block';
                tooltipEl.innerHTML = `
                    <div class="tooltip-country">${country}</div>
                    <div class="tooltip-data" id="tooltip-data"></div>
                `;

                tooltipEl.style.left = (event.pageX + 10) + 'px';
                tooltipEl.style.top = (event.pageY - 10) + 'px';

                updateTooltipData(event, d);
            })
            .on('mousemove', function(event, d) {
                tooltipEl.style.left = (event.pageX + 10) + 'px';
                tooltipEl.style.top = (event.pageY - 10) + 'px';
                updateTooltipData(event, d);
            })
            .on('mouseout', function() {
                svg.selectAll('.stream').classed('inactive', false);
                tooltipEl.style.display = 'none';
            });

        function updateTooltipData(event, stackedSeries) {
            const svgRect = d3.select('#chart svg').node().getBoundingClientRect();
            const chartX = Math.max(0, Math.min(width, event.clientX - svgRect.left - margin.left));

            const hoveredYear = xScale.invert(chartX);
            const closestYear = years.reduce((prev, curr) => (
                Math.abs(curr - hoveredYear) < Math.abs(prev - hoveredYear) ? curr : prev
            ), years[0]);

            const yearData = stackData.find(d => d.year === closestYear);

            if (yearData) {
                const volume = yearData[stackedSeries.key];
                const volumeFormatted = volume.toLocaleString('en-US', {
                    maximumFractionDigits: 0
                });

                document.getElementById('tooltip-data').innerHTML =
                    `${closestYear}: ${volumeFormatted} kg`;
            }
        }

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
        chartEl.innerHTML = '<p style="color: red; padding: 20px;">Error loading data. Check console for details.</p>';
    });
}

renderChart(dataSelectEl.value);

dataSelectEl.addEventListener('change', event => {
    renderChart(event.target.value);
});

speciesFilterEl.addEventListener('change', () => {
    renderChart(dataSelectEl.value);
});

toyosuPriceFilterEl.addEventListener('change', () => {
    renderChart(dataSelectEl.value);
});
