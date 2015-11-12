<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta http-equiv="X-UA-Compatible" content="IE=edge">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="description" content="">
	<meta name="author" content="">

	<link rel="stylesheet" href="/vendor/bootstrap/dist/css/bootstrap.min.css" />
	<style>
		.line-legend {
			position: absolute;
			list-style-type: none;
			padding: 0.5rem 1rem;
			margin-left: 40px;
			border: 1px solid #ddd;
			top: 2rem;
		}

		.line-legend span {
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
	<div class="container-fluid">
		<div class="row">
			<div class="col-xs-12">
				<h1>NodeBB Package Manager Statistics</h1>
				<p class="lead">
					For informational purposes, the nbbpm keeps a count of how many queries
					are made to various endpoints. As a matter of transparency, these results
					are shared with you here.
				</p>
				<p>
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
			<div class="col-xs-12 col-sm-6 col-md-4">
				<div style="width: 100%; height: 60px; border: 2px dashed #aaa;">
					<p class="text-center" style="line-height: 60px;">
						<em>To be announced...</em>
					</p>
				</div>
			</div>

			<div class="col-xs-12 col-sm-6 col-md-4">
				<div style="width: 100%; height: 60px; border: 2px dashed #aaa;">
					<p class="text-center" style="line-height: 60px;">
						<em>To be announced...</em>
					</p>
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
				index: $('[data-chart="index"]').get(0).getContext('2d')
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

		// Figure 1
		$.ajax({
			url: '/api/v1/analytics/index'
		}).success(function(data) {
			fixWidths();

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
			console.log(legend);
			$('[data-chart="index"]').before(legend);
		});

		function fixWidths() {
			$('[data-chart]').each(function(idx, el) {
				var attr = el.getAttribute('data-chart');
				contexts[attr].canvas.width = $(el).parent().width();
			});
		}
	</script>
</body>
</html>