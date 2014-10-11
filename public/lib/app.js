"use strict";

var app = {
    csrf: null
};

app.getCSRF = function() {
    return app.csrf || $('#csrf').val();
};

app.init = function() {
    var csrf = app.getCSRF();

    $('.nav li').removeClass('active');
    var path = window.location.pathname.slice(1).split('/')[0];
    if (!path) {
        path = 'home';
    }
    $('.nav-' + path).addClass('active');

    $('#logout').on('click', function() {
        $.post('/logout', {_csrf: csrf}, function() {
            window.location.href='/';
        });
    });
};

$(document).ready(app.init);