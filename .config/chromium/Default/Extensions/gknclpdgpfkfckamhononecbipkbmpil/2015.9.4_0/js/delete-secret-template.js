if (!!!templates) var templates = {};
templates["delete-secret-template"] = new Hogan.Template({code: function (c,p,i) { var t=this;t.b(i=i||"");t.b("<p>Are you sure you want to delete ");t.b(t.v(t.f("name",c,p,0)));t.b("?</p>");t.b("\n" + i);t.b("<p>THIS WILL DELETE THE SECRET FOR ALL USERS AND THE PASSWORD WILL NOT BE RECOVERABLE</p>");return t.fl(); },partials: {}, subs: {  }});
