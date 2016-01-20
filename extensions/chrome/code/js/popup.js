'use strict';

(function() {
  console.log('POPUP SCRIPT WORKS!');

  var form = require('./modules/form');
  form.init();

  var $ = require('./libs/jquery');

  $(function() {
    $('#go-to-options').on('click', function() {
      chrome.runtime.openOptionsPage();
    });
  });
})();
