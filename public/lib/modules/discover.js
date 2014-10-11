"use strict";

(function() {
	var type = '{type}';
	$('body').addClass('discover-body');

	var tags = null;
	$('.search').on('keyup', function() {
		var keyword = $(this).val();
		tags = tags || $('.tag');

		tags.each(function(i, el) {
			el = $(el);
			if (el.attr('data-tag').indexOf(keyword) !== -1) {
				el.addClass('toShow');
			}
		});

		$('.search-total').html($('.toShow').parents('.well').length);

		$('.tag').parents('.well').hide();
		$('.toShow').removeClass('toShow').parents('.well').show();
	});

	$(document).ready(function() {
		$('.nav-' + type).addClass('active');
	});
}());