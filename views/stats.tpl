<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta http-equiv="X-UA-Compatible" content="IE=edge">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="description" content="">
	<meta name="author" content="">

	<link rel="stylesheet" href="/vendor/bootstrap/dist/css/bootstrap.min.css" />

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
			</div>
		</div>
		<div class="row">
			<div class="col-xs-12 col-sm-6 col-md-4">
				<canvas data-chart="index" width="800" height="400"></canvas>
				<p>
					<strong>Figure 1</strong><br />
					Queries to retrieve plugin list, by version number.
				</p>
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
		for(var x=0,tmp;x<24;x++) {
			tmp = hour.getTime() - (x * 1000 * 60 * 60);
			labels.push(new Date(tmp).getHours());
		}

		$.ajax({
			url: '/api/v1/analytics/index'
		}).success(function(data) {
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
			data[1].pointHighlightStroke = "rgba(151,187,205,1)";

			charts.index = new Chart(contexts.index).Line({
				labels: labels,
				datasets: data
			});
		});
	</script>
</body>
</html>