// Copyright © 2013, Jeremy Heiner (github.com/JHeiner).
// All rights reserved. See LICENSE file.

"use strict";

$(function () {

	window.doodles =
		new Doodles.Extension(new Doodles.CoverBody(document.body,window));

	window.doodles.toggle();

});
