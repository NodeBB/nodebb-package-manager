<h3 class="cover-heading">NodeBB Package Manager</h3>
<!-- IF username -->
<p class="lead">Welcome <strong>{username}</strong>! Your feedback is greatly appreciated and will benefit the entire NodeBB community.</p>
<form class="login-form" style="display: none">
	<div class="row">
		<div class="col-xs-4">
			<select class="form-control package-type">
				<option value="nodebb-theme-">nodebb-theme-</option>
				<option value="nodebb-plugin-">nodebb-plugin-</option>
			</select>
		</div>
		<div class="col-xs-8">
			<div class="form-group">
				<input class="form-control login-field package" value="" placeholder="package-name" name="package" type="package" required autofocus>
				<label class="login-field-icon fui-heart" for="package"></label>
			</div>
		</div>
	</div>

	<div class="row">
		<div class="col-xs-9">
			<a data-method="approved" class="btn btn-primary btn-lg btn-block" href="#"><span class="confirm-message">Confirm latest works with</span> <strong>{version}</strong></a>
		</div>
		<div class="col-xs-3">

			<a data-method="unflagged" class="btn dropdown-toggle btn-lg btn-block clearfix btn-danger hide unflag">Unflag</a>
			<div class="btn-group select select-block">
				<button class="btn dropdown-toggle btn-lg btn-block clearfix btn-danger flag" data-toggle="dropdown">
					<span class="filter-option pull-left">Flag</span>&nbsp;<span class="caret"></span></button>
					<span class="dropdown-arrow dropdown-arrow-inverse"></span>
					<ul class="dropdown-menu dropdown-inverse" role="menu">
						<li rel="0">
							<a data-method="offensive" tabindex="-1" href="#" class="dropdown-option"><span class="pull-left">Offensive Material</span></a>
						</li>
						<li rel="1">
							<a data-method="exploit" tabindex="-1" href="#" class="dropdown-option"><span class="pull-left">Security Exploit</span></a>
						</li>
					</ul>
				</button>
			</div>
		</div>
	</div>
</form>
<!-- ELSE -->
<p class="lead">If you are a developer, sign in with GitHub to help us provide quality control on themes and plugins.</p>
<a href="/auth/github" class="btn btn-lg btn-primary">Sign In with GitHub</a>
<!-- ENDIF username -->

<script type="text/javascript" src="lib/modules/index.js"></script>