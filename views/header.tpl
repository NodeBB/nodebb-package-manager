<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta http-equiv="X-UA-Compatible" content="IE=edge">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="description" content="">
	<meta name="author" content="">

	<title>NodeBB Package Manager</title>

	<link href="/css/bootstrap.css" rel="stylesheet">
	<link href="/css/flat-ui.css" rel="stylesheet">
	<link href="/css/theme.css" rel="stylesheet">
	<link href="/css/toastr.css" rel="stylesheet">
	<link href="//netdna.bootstrapcdn.com/font-awesome/4.0.3/css/font-awesome.css" rel="stylesheet">

<!--[if lt IE 9]>
<script src="//oss.maxcdn.com/libs/html5shiv/3.7.0/html5shiv.js"></script>
<script src="//oss.maxcdn.com/libs/respond.js/1.4.2/respond.min.js"></script>
<![endif]-->
<script type="text/javascript" src="//code.jquery.com/jquery-1.11.0.min.js"></script>
<script type="text/javascript" src="//cdnjs.cloudflare.com/ajax/libs/toastr.js/2.0.1/js/toastr.min.js"></script>
<script type="text/javascript" src="/lib/app.js"></script>
</head>

<body>
	<div class="site-wrapper">
		<div class="site-wrapper-inner">
			<div class="cover-container">
				<input type="hidden" id="csrf" value="{csrf}" />
				<div class="masthead clearfix">
					<div class="inner">
						<h4 class="masthead-brand">NBBPM</h4>
						<ul class="nav masthead-nav">
							<li class="nav-home"><a href="/">Home</a></li>
							<li class="nav-discover"><a href="/discover">Discover</a></li>
							<li class="nav-leaderboard"><a href="/leaderboard">Leaderboard</a></li>
							<!-- IF username -->
							<li><a href="/logout">Logout</a></li>
							<!-- ELSE -->
							<li class="nav-github"><a href="/auth/github">Sign in with GitHub</a></li>
							<!-- ENDIF username -->
						</ul>
					</div>
				</div>
				<div class="inner cover">