"use strict";
/*global toastr, app*/

$(document).ready(function() {
	var init = false;

	$('a[data-method]').on('click', function(ev) {
		var btn = $(this).attr('data-loading-text', 'Loading...').button('loading');

		$.post('/api/v1/rate', {
			method: $(this).attr('data-method'),
			name: $('.package').val(),
			type: $('.package-type').val(),
			_csrf: app.getCSRF()
		}, function(data) {
			toastr[data.type](data.message);
			checkVoted();
			btn.button('reset');
			if (data.awarded) {
				setTimeout(function() {
					toastr.success('Thanks for rating this package for the first time, you earned +' + data.awarded + ' points!');
				}, 1000);
			}
		});
	});

	toastr.options = {
		"closeButton": false,
		"debug": false,
		"positionClass": "toast-top-right",
		"onclick": null,
		"showDuration": "300",
		"hideDuration": "1000",
		"timeOut": "5000",
		"extendedTimeOut": "1000",
		"showEasing": "swing",
		"hideEasing": "linear",
		"showMethod": "fadeIn",
		"hideMethod": "fadeOut"
	};

	function checkVoted() {
		if ($('.package').val().length > 3) {
			var data = {
				pkg: $('.package-type').val() + $('.package').val(),
				_csrf: app.getCSRF()
			};

			$.post('/api/v1/rate/get', data, function(data) {
				$('.confirm-message').html(data.hasApproved ? 'Unconfirm that latest works with' : 'Confirm latest works with');
				$('.confirm-message').parent().attr('data-method', data.hasApproved ? 'unapproved' : 'approved');

				if (data.hasFlagged) {
					$('.flag').addClass('hide');
					$('.unflag').removeClass('hide');
				} else {
					$('.unflag').addClass('hide');
					$('.flag').removeClass('hide');
				}
			});
		} else {
			$('.confirm-message').html('Confirm latest works with');
			$('.confirm-message').parent().attr('data-method', 'approved');
			$('.unflag').addClass('hide');
			$('.flag').removeClass('hide');
		}

		if (!init) {
			$('.login-form').hide().fadeIn(750);
			init = true;
		}
	}

	$('.package').on('keyup', checkVoted);
	$('.package').on('blur', checkVoted);
	checkVoted();
});