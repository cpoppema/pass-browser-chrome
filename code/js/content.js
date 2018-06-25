'use strict';

/**
 * Allow console.debug output during development.
 */
function debug() {
  if (!('update_url' in chrome.runtime.getManifest())) {
    console.debug.apply(console, arguments);
  }
}

(function content() {
  var $ = require('jquery');

  var formSelector = 'form';
  var usernameFieldSelector = ['[type="email"]:visible',
                               '[type="text"]:visible',
                               'input:not([type]):visible',
                               '[type="textbox"]',
                              ].join(',');
  var passwordFieldSelector = '[type="password"]';
  var tokenFieldSelector = ['[type="text"]:visible',
                            '[type="number"]:visible',
                            '[type="password"]:visible',
                            'input:not([type]):visible',
                            '[type="textbox"]',
                           ].join(',');


  /**
   * Helper function to rate a form.
   */
  function scoreForm(form) {
    if ($(document.activeElement).is('input')) {
      if (form === $(document.activeElement).closest('form').get(0)) {
        return 5;
      }
    }

    var potentialUsernameFields = $(form)
      .find(usernameFieldSelector);
    var potentialPasswordFields = $(form)
      .find(passwordFieldSelector);

    // 0 points if the form has no text or password inputs
    if (potentialUsernameFields.length === 0 &&
        potentialPasswordFields.length === 0
    ) {
      return 0;
    }

    // 4 points for a form with just one text and one password input
    if (potentialUsernameFields.length === 1 &&
        potentialPasswordFields.length === 1
    ) {
      return 4;
    }

    // 3 points for a form with just one password input
    if (potentialUsernameFields.length === 0 &&
        potentialPasswordFields.length === 1
    ) {
      return 3;
    }

    // 2 points for a form with just one text
    if (potentialUsernameFields.length === 1 &&
        potentialPasswordFields.length === 0
    ) {
      return 2;
    }

    // 1 point for a form with more than one text input and one password input
    if (potentialUsernameFields.length > 1 &&
        potentialPasswordFields.length === 1
    ) {
      return 1;
    }

    // probably multiple password fields, form fill can still looking at
    // document.activeElement
    return 0;
  }

  /**
   * Helper function to find a form.
   */
  function findForm() {
    var highscore = 0;
    var highscoreForm = null;
    var potentialForm;
    var potentialForms = $(formSelector);

    if (!potentialForms.length) {
      // no (visible) forms in page
      debug('no form detected with selector "' + formSelector + '"');
      return null;
    }

    // in case the page has autofocus, or the user selected an input already,
    // use this as an indicator to find the nearest form element
    if ($(document.activeElement).is('input')) {
      potentialForm = $(document.activeElement).closest('form');
      if (potentialForm.length) {
        debug('use the form closest to', document.activeElement, potentialForm);
        highscoreForm = potentialForm.get(0);
        highscore = scoreForm(highscoreForm);
      } else {
        debug('no form close to element:', document.activeElement);
      }
    }

    if (highscoreForm === null) {
      // find highest scoring form
      $.each(potentialForms, function scorePotentialForm(i, potentialForm) {
        var score = scoreForm(potentialForm);
        debug('scored', score, 'with',
              $(potentialForm).find(usernameFieldSelector).length,
              'potential username field(s) and',
              $(potentialForm).find(passwordFieldSelector).length,
              'potential password field(s):',
              potentialForm);
        if (score > highscore) {
          if (highscoreForm !== null) {
            debug('replacing highscoreForm by a score of', score,
                  'with:', potentialForm);
          }

          highscore = score;
          highscoreForm = potentialForm;

          if (score === 4) {
            // break the .each-loop
            return false;
          }
        }
      });
    }

    if (highscore === 5) {
      debug('best form is picked through document.activeElement');
    }
    if (highscore === 4) {
      debug('best form has one username and one password field');
    }
    if (highscore === 3) {
      debug('best form has just a password field');
    }
    if (highscore === 2) {
      debug('best form has just a username field');
    }
    if (highscore === 1) {
      debug('best form has one password field, ' +
                    'but multiple text fields');
    }
    if (highscore === 0) {
      debug('no form was any good');
    }

    if (highscore <= 1) {
      highscoreForm = null;
    }

    debug('decided on using form:', highscoreForm);

    return highscoreForm;
  }

  /**
   * Helper function to find a *visible* username field.
   */
  function findUsernameField(container) {
    var usernameField;

    // in case the page has autofocus, or the user selected an input already,
    // use this element if it matches usernameFieldSelector
    if ($(document.activeElement).is(usernameFieldSelector)) {
      usernameField = document.activeElement;
      return usernameField;
    }

    // no selected element: fallback to finding a username field ourselves
    usernameField = $(container).find(usernameFieldSelector);
    if ($(usernameField).length === 1) {
      return usernameField.get(0);
    }
  }

  /**
   * Helper function to find a password field.
   */
  function findPasswordField(container) {
    var passwordField;

    // in case the page has autofocus, or the user selected an input already,
    // use this element if it matches passwordFieldSelector
    if ($(document.activeElement).is(passwordFieldSelector)) {
      return document.activeElement;
    }

    // no selected element: fallback to finding a password field ourselves
    passwordField = $(container).find(passwordFieldSelector);
    if ($(passwordField).length === 1) {
      return passwordField.get(0);
    } else if ($(passwordField).length > 1) {
      // multiple fields found, maybe there is only one visible
      if ($(passwordField).filter(':visible').length === 1) {
        return passwordField.filter(':visible').get(0);
      }
    }
  }

  /**
   * Helper function to find a token field.
   */
  function findTokenField(container) {
    var tokenField;

    // in case the page has autofocus, or the user selected an input already,
    // use this element if it matches tokenFieldSelector
    if ($(document.activeElement).is(tokenFieldSelector)) {
      return document.activeElement;
    }

    // no selected element: fallback to finding a password field ourselves
    tokenField = $(container).find(tokenFieldSelector);
    if ($(tokenField).length === 1) {
      return tokenField.get(0);
    } else if ($(tokenField).length > 1) {
      // multiple fields found, maybe there is only one visible
      if ($(tokenField).filter(':visible').length === 1) {
        return tokenField.filter(':visible').get(0);
      }
    }
  }

  /**
   * Helper function to trigger events that the site might listen to, this can
   * help removing custom placeholders for example.
   */
  function triggerChange(elem) {
    elem.dispatchEvent(new window.Event('change', {bubbles: true}));
    elem.dispatchEvent(new window.Event('input', {bubbles: true}));
    elem.dispatchEvent(new window.KeyboardEvent('keydown', {bubbles: true}));
    elem.dispatchEvent(new window.KeyboardEvent('keyup', {bubbles: true}));
  }

  var handlers = {
    fillForm: function fillForm(username, password) {
      var container = findForm();
      if (container === null) {
        container = document.body;
      }

      var usernameField = findUsernameField(container);
      var passwordField = findPasswordField(container);

      if (usernameField) {
        $(usernameField).val(username);
        triggerChange($(usernameField).get(0));
      } else {
        debug('no field found for username in container:', container);
      }

      // passwordField is allowed to be invisible if there is a usernameField
      if ($(passwordField).is(':visible') || passwordField && usernameField) {
        $(passwordField).val(password);
        triggerChange($(passwordField).get(0));
      } else {
        debug('no field found for password in container:', container);
      }
    },

    fillToken: function fillToken(token) {
      var container = findForm();
      if (container === null) {
        container = document.body;
      }

      var tokenField = findTokenField(container);

      if (tokenField) {
        $(tokenField).val(token);
        triggerChange($(tokenField).get(0));
      } else {
        debug('no field found for token in container:', container);
      }
    },
  };

  require('./modules/msg').init('ct', handlers);
})();
