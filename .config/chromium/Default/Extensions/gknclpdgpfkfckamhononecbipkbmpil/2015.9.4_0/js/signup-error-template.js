if (!!!templates) var templates = {};
templates["signup-error-template"] = new Hogan.Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("Sorry, an error has occurred.<br>");t.b("\n" + i);t.b("Already have an account? <a class=\"button button-light button-sm\" href=\"");t.b(t.v(t.f("loginUrl",c,p,0)));t.b("\">Sign In</a>");return t.fl(); },partials: {}, subs: {  }});
