<br /><br />
<nav class="navbar navbar-inverse navbar-embossed" role="navigation">
<div class="navbar-header">
  <button type="button" class="navbar-toggle" data-toggle="collapse" data-target="#navbar-collapse-01">
    <span class="sr-only">Toggle navigation</span>
  </button>
</div>
<div class="collapse navbar-collapse" id="navbar-collapse-01">
  <ul class="nav navbar-nav navbar-left">           
	   <li class="nav-plugins"><a href="/discover/plugins">Plugins</a></li>
	  <li class="nav-themes"><a href="/discover/themes">Themes</a></li>
   </ul>
   <ul class="nav navbar-nav navbar-right">
   		<li>
   			<form class="login-form navbar-form" style="padding: 0; margin: 8px;">
			<div class="form-group">
				<input class="form-control search" name="search" placeholder="search by tag..." />
				<label class="login-field-icon fui-search" for="search" style="margin-top: -4px;"></label>
			</div>
			</form>
		</li>
   </ul>
</div><!-- /.navbar-collapse -->
</nav>

<span>A total of <strong class="search-total">{total}</strong> {type} were found.</span>
<div class="discover leaderboard">
	<!-- BEGIN packages -->
	<div class="well">
		<strong><a href="https://npmjs.com/package/{packages.name}" target="_blank">{packages.name} <small><i class="fa fa-external-link"></i></small></a></strong><br /><small>{packages.description}</small><br /><br />
		<div class="pull-right">
			<!-- BEGIN tags -->
			<span class="label label-success tag label-{packages.tags.name}" data-tag="{packages.tags.name}"><small>{packages.tags.name}</small></span>
			<!-- END tags -->
		</div>
		<div class="clearfix clear"></div>
	</div>
	<!-- END packages -->
</div>

<script type="text/javascript" src="lib/modules/discover.js"></script>