desktopApp = {
	buttonCount: 1,
	init: function(){
		webix.env.codebase = "./";
		this.createLayout();
		this.createToolbar();

		webix.attachEvent("onFocusChange", function(view){
			if(view){
				var win = view.getTopParentView();
				var id = win.config.id;
				if(id.indexOf("_win") != -1){
					desktopApp.setActiveWindow(id);
				}
			}
		});
	},
	createLayout: function(){
		webix.ui({
			id: "screens",
			animate: false,
			cells:[
				{
					view:"layout",
					id: "main",
					css:"desktop-layout",
					type: "clean",
					cols:[
						{
							view: "list",
							id: "desktop",
							width: 105,
							css:"desktop-items",

							type: {
								height: 110,
								template: "<div class='desktop-item-inner'><img src='#image#'><div class='desktop-icons'> #title#</div></div>",
								css:"desktop-item"
							},
							select: "multiselect",
							drag: true,
							data: webix.copy(desktop_icons),
							on: {
								onItemDblClick: desktopApp.wins.showApp
							}
						},
						{}
					]
				}
			]
		});
	},
	createToolbar: function(){
		webix.ui({
			view:"toolbar",
			id:"toolbar",
			paddingY:2, height:40,
			css:"toolbar-bottom",
			cols: [
				{
					view: "button",
					id: "start_button",
					css:"webix_transparent",
					type: "image",
					image: "img/start.png",
					width: 72,
					on: {
						onItemClick: function () {
						}
					}
				},
				{},
				{ view:"template", id:"time", width:95, css:"time-template" }
			]
		});
	},
	deleteActiveBg: function(){
		var views = $$("toolbar").getChildViews();
		for(var i=0; i < views.length; i++) {
			var id = views[i].config.id;
			webix.html.removeCss($$(id).$view, "active");
		}
	},
	setActiveWindow: function(id){
		desktopApp.wins.setActiveStyle(id);
		var btn = $$(id.replace("win","button"));
		if(btn){
			desktopApp.deleteActiveBg();
			webix.html.addCss(btn.$view, "active");
		}
	},
	// show toolbar button for a window
	beforeWinShow: function(name){
		var id = (typeof name == "object"?(name.id+"_button"):(name+"_button"));
		var winId = (typeof name == "object"?(name.id+"_win"):(name+"_win"));
		var btn = $$(id);
		if( btn == webix.undefined){
			var template = "";
			if(typeof name == "object"){
				if(name.img){
					template = "<div class='"+name.$css+"'><img class='"+name.$css+"' src='"+name.img+"'></div>";
				}
				else if(name.icon){
					template = "<div class='"+name.$css+"'><span class='webix_icon mdi mdi-"+name.icon+"'></span></div>";
				}
			}
			else{
				template = "<img class='app_icon' src='img/"+name+".png'>";
			}

			webix.ui({
				view:"button",
				id: id,
				css:"toolbar-icon",
				type:"htmlbutton",
				label: template,
				width:40,
				on:{
					onItemClick:function(){
						$$(winId).show();
						$$(winId).config.active = true;
						desktopApp.deleteActiveBg();
						webix.html.addCss(btn.$view, "active");
					}
				}
			});
			btn = $$(id);
			$$("toolbar").addView(btn,this.buttonCount);
			desktopApp.deleteActiveBg();
			webix.html.addCss(btn.$view, "active");
			this.buttonCount++;
		}
		else {
			desktopApp.deleteActiveBg();
			webix.html.addCss(btn.$view, "active");
		}
	}
};