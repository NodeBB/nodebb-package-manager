<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta http-equiv="X-UA-Compatible" content="IE=edge">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="description" content="">
	<meta name="author" content="">

	<link rel="stylesheet" href="/vendor/bootstrap/dist/css/bootstrap.min.css" />
	<link rel="stylesheet" href="/public/bootswatch-yeti.css" />
	<style>
		.line-legend {
			position: absolute;
			list-style-type: none;
			padding: 0.5rem 1rem;
			margin-left: 40px;
			border: 1px solid #ddd;
			top: 2rem;
		}

		.pie-legend {
			list-style-type: none;
			padding: 0.5rem 1rem;
			margin-left: 40px;
			border: 1px solid #ddd;
			margin-left: 0px;
		}

		.line-legend span, .pie-legend span {
			display: inline-block;
			width: 10px;
			height: 10px;
			margin-right: 1rem;
		}

		.chart-block p {
			font-size: 1.2rem;
		}

		.plugin-list h3 {
			font-size: 1.5rem;
			font-weight: bold;
		}

		.plugin-list h4 {
			font-size: 1.3rem;
		}

		.plugin-list p {
			font-size: 1.2rem;
		}
	</style>

	<title>NodeBB Package Manager Statistics</title>
</head>

<body>
	<div class="container">
		<div class="row">
			<div class="col-xs-12">
				<h1>NodeBB Package Manager Statistics</h1>
				<p class="lead">
					For informational purposes, the nbbpm keeps a count of how many queries
					are made to various endpoints. As a matter of transparency, these results
					are shared with you here.
				</p>
				<p class="alert alert-info">
					The current server time is: {serverTime}
				</p>
			</div>
		</div>
		<div class="row">
			<div class="col-xs-12 chart-block">
				<canvas data-chart="index" width="800" height="400"></canvas>
				<p>
					<strong>Figure 1</strong><br />
					Queries to retrieve plugin list, by version number, for the past 24 hours.
				</p>
			</div>
		</div>
		<div class"row">
			<div class="col-xs-12 col-sm-6 col-md-4 chart-block">
				<div class="panel panel-default">
					<div class="panel-body">
						<canvas data-chart="top/week" width="400" height="400"></canvas>
						<p>
							<strong>Figure 2</strong><br />
							Top 5 plugin downloads in the past 7 days
						</p>
					</div>
				</div>
				<div class="panel panel-default">
					<div class="panel-body">
						<canvas data-chart="top/all" width="400" height="400"></canvas>
						<p>
							<strong>Figure 3</strong><br />
							Top 10 plugin downloads of since November 2015
						</p>
					</div>
				</div>
			</div>

			<div class="col-xs-12 col-sm-6 col-md-4 chart-block">
				<div class="panel panel-default">
					<div class="panel-body">
						<table class="table table-striped">
							<thead>
								<th>Country</th>
								<th></th>
							</thead>
							<tbody>
								<!-- BEGIN geo -->
								<tr>
									<td>{../country}</td>
									<td>{../count}</td>
								</tr>
								<!-- END geo -->
							</tbody>
						</table>
						<p>
							<strong>Table 1</strong><br />
							Number of requests by country, within the past 48 hours
						</p>
					</div>
				</div>
			</div>

			<div class="col-xs-12 col-sm-6 col-md-4">
				<div class="panel panel-default plugin-list">
					<div class="panel-heading">
						<h3 class="panel-title">Recently Added/Updated</h3>
					</div>
					<div class="panel-body">
						<!-- BEGIN latest -->
						<div class="media">
							<div class="media-body">
								<h4 class="media-heading">
									<!-- IF ../url --><a href="{../url}">{../name}</a><!-- ELSE -->{../name}<!-- ENDIF ../url -->
								</h4>
								<p>{../description}</p>
							</div>
						</div>
						<!-- END latest -->
					</div>
				</div>
			</div>
		</div>
	</div>

	<script src="/vendor/jquery/dist/jquery.min.js"></script>
	<script src="/vendor/bootstrap/dist/js/bootstrap.min.js"></script>
	<script src="/vendor/Chart.js/Chart.min.js"></script>
	<script>
		var contexts = {
				index: $('[data-chart="index"]').get(0).getContext('2d'),
				'top/week': $('[data-chart="top/week"]').get(0).getContext('2d'),
				'top/all': $('[data-chart="top/all"]').get(0).getContext('2d')
			},
			charts = {
				index: undefined
			},
			hour = new Date(),
			labels = [];

		// Construct labels
		hour.setHours(hour.getHours(), 0, 0, 0);
		for(var x=23,tmp,mer;x>=0;x--) {
			tmp = new Date(hour.getTime() - (x * 1000 * 60 * 60)).getHours();
			labels.push(tmp + ':00');
		}

		fixWidths();

		// Figure 1
		$.ajax({
			url: '/api/v1/analytics/index'
		}).done(function(data) {
			data[0].fillColor = "rgba(220,220,220,0.2)";
			data[0].strokeColor = "rgba(220,220,220,1)";
			data[0].pointColor = "rgba(220,220,220,1)";
			data[0].pointStrokeColor = "#fff";
			data[0].pointHighlightFill = "#fff";
			data[0].pointHighlightStroke = "rgba(220,220,220,1)";

			data[1].fillColor = "rgba(151,187,205,0.2)";
			data[1].strokeColor = "rgba(151,187,205,1)";
			data[1].pointColor = "rgba(151,187,205,1)";
			data[1].pointStrokeColor = "#fff";
			data[1].pointHighlightFill = "#fff";
			data[0].pointHighlightStroke = "rgba(151,187,205,1)";

			data[2].fillColor = "rgba(187,205,151,0.2)";
			data[2].strokeColor = "rgba(187,205,151,1)";
			data[2].pointColor = "rgba(187,205,151,1)";
			data[2].pointStrokeColor = "#fff";
			data[2].pointHighlightFill = "#fff";
			data[2].pointHighlightStroke = "rgba(187,205,151,1)";

			charts.index = new Chart(contexts.index).Line({
				labels: labels,
				datasets: data
			});

			var legend = charts.index.generateLegend();
			$('[data-chart="index"]').before(legend);
		});

		// Figure 2
		$.ajax({
			url: '/api/v1/analytics/top/week'
		}).done(function(data) {
			var colours = ['#F44336', '#2196F3', '#4CAF50', '#ffc107', '#e91e63'],
				highlights = ['#EF5350', '#42A5F5', '#66BB6A', '#ffca28', '#ec407a'];

			charts['top/week'] = new Chart(contexts['top/week']).Pie(data.map(function(set, idx) {
				set.color = colours[idx];
				set.highlight = highlights[idx];
				return set;
			}));

			var legend = charts['top/week'].generateLegend();
			$('[data-chart="top/week"]').after(legend);
		});

		// Figure 3
		$.ajax({
			url: '/api/v1/analytics/top/all'
		}).done(function(data) {
			var colours = ['#F44336', '#2196F3', '#4CAF50', '#ffc107', '#e91e63', '#9C27B0', '#009688', '#CDDC39', '#795548', '#3F51B5'],
				highlights = ['#EF5350', '#42A5F5', '#66BB6A', '#ffca28', '#ec407a', '#AB47BC', '#26A69A', '#D4E157', '#8D6E63', '#5C6BC0'];

			charts['top/all'] = new Chart(contexts['top/all']).Pie(data.map(function(set, idx) {
				set.color = colours[idx];
				set.highlight = highlights[idx];
				return set;
			}));

			var legend = charts['top/all'].generateLegend();
			$('[data-chart="top/all"]').after(legend);
		});

		function fixWidths() {
			$('[data-chart]').each(function(idx, el) {
				var attr = el.getAttribute('data-chart');
				contexts[attr].canvas.width = $(el).parent().width();

				if (attr === 'top/week' || attr === 'top/all') {
					contexts[attr].canvas.height = $(el).parent().width();
				}
			});
		}
	</script>
</body>
</html>