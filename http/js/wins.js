if(window.desktopApp)
	desktopApp.wins = {
		active: null,
		setActiveStyle: function(winId){
			if(desktopApp.wins.active)
				webix.html.removeCss($$(desktopApp.wins.active).$view,"active_win");
			webix.html.addCss($$(winId).$view,"active_win",true);
			desktopApp.wins.active = winId;
		},
		forEachWindow: function(func){
			var views = $$("toolbar").getChildViews();
			for(var i =1; i< views.length; i++){
				if(views[i].config.id.indexOf("_button") != -1){
					var id = views[i].config.id.replace("button","win");
					if($$(id))
						func.call(this,id);
				}
			}
		},
		hideAllWindows: function(){
			this.forEachWindow(function(id){
				if($$(id).isVisible()){
					$$(id).hide();
					webix.html.removeCss($$(id.replace("_win","_button")).$view, "active");
				}
			});
		},
		getVisibleWinCount: function(){
			var count = 0;
			this.forEachWindow(function(id){
				if($$(id).isVisible())
					count++;
			});
			return count;
		},
		getPosition: function(state){
			state.left = this.config.left;
			state.top = this.config.top;
			if(state.height + 40 >= state.maxHeight){
				state.height = state.maxHeight - 40;
			}
			if(this.config.fullscreen){
				if (!this.config.lastWindowPos)
					this.config.lastWindowPos = { top: state.top, left: state.left };
				state.top = state.left = 0;
			}
			else{
				if (this.config.lastWindowPos){
					var last = this.config.lastWindowPos;
					delete this.config.lastWindowPos;
					state.top = last.top;
					state.left = last.left;
				}
				if(state.left+state.width > state.maxWidth){
					state.left -= state.left+state.width - state.maxWidth;
				}
				if(state.top+state.height +40 > state.maxHeight){
					state.top -= state.top+state.height +40 - state.maxHeight;
				}
			}

		},
		showApp: function(name,width,height){
			var winId = name+"_win";
			var c = desktopApp.wins.getVisibleWinCount();
			if(!$$(winId)){
				var config = desktopApp.ui[name];
				webix.ui({
					view:"window",
					id: winId,
					css:"popup-window-custom app "+ config.css || "",
					position: desktopApp.wins.getPosition,
					resize: true,
					left: document.documentElement.clientWidth/2 - 400 + 15*c,
					top: document.documentElement.clientHeight/2 - 225 - 40 + 25*c,
					move:true,
					toFront: true,
					width: name.indexOf("popup") == -1 ? GetWidth() : width,
                	height: name.indexOf("popup") == -1 ? GetHeight() : height,
					head: desktopApp.ui.toolbar.apply(this,config.toolbar()),
					body: config.body(),
					on: config.events
				});
			}
			$$(winId).show();
			desktopApp.wins.setActiveStyle(winId);
		},
	};