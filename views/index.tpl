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
		.mb-3 { margin-bottom: 1rem; }
	</style>

	<title>NodeBB Package Manager - Plugin List</title>
</head>

<body>
	<div class="container">
		<div class="row">
			<div class="col-xs-12">
				<h1>NodeBB Package Manager - Plugin List</h1>
				<p class="lead">
					This page shows a listing of NodeBB plugins that are compatible with a given NodeBB version.
				</p>
			</div>

			<div class="col-xs-12 mb-3">
				<select class="form-control" id="version-select">
					<!-- BEGIN versions -->
					<option value="{../version}" <!-- IF ../selected -->selected<!-- ENDIF ../selected -->>
						{../version}
					</option>
					<!-- END versions -->
				</select>
			</div>

			<div class="col-xs-12 mb-3">
				<div class="list-group">
					<!-- BEGIN packages -->
  					<a href="#" class="list-group-item">
    					<h4 class="list-group-item-heading">{../name}</h4>
    					<p class="list-group-item-text">{../description}</p>
  					</a>
					<!-- END packages -->
				</div>
			</div>
		</div>
	</div>

	<script src="/vendor/jquery/dist/jquery.min.js"></script>
	<script src="/vendor/bootstrap/dist/js/bootstrap.min.js"></script>
	<script>
		$('#version-select').on('change', function() {
			var selectedVersion = $(this).val();
			window.location.href = '/?version=' + selectedVersion;
		});
	</script>
</body>
</html>