/* =============== SHEET =============== */
function AddRow( data ){
	$$("spreadsheet").parse( data );
}
function ResetSheet(){
	mColumnName = [];
	mBaseData.data = [];
	$$("spreadsheet").config.columnCount = 0;
    $$("spreadsheet").config.rowCount = 0;
    $$("spreadsheet").detachEvent("onBeforeValueChange");
    $$("spreadsheet").reset();
}
function CreateSheet(){
    let i, j;
	let value;
	let tStruct = GetStruct( GetValue( mStructList.id ) );
    console.log( tStruct );
	if( tStruct.size == 0 ){
		Alert( mError, "undefined structure" );
		return;
	}
    mPosition = 4;
    mColumnCount = 0;
    mRowCount = 0;
    ResetSheet();
    mRowCount = mOriginal.Int(0);
	mColumnCount = tStruct.value.length;
	for( i = 0; i < mColumnCount; i++ ){
		mColumnName.push( tStruct.value[i].name );
	}
	for( i = 0; i < mRowCount; i++ ){
		tPosition = mPosition + ( tStruct.size * i );
		for( j = 0; j < tStruct.value.length; j++ ){
			tCurPosition = tStruct.value[j].position + tPosition;
			if( tStruct.value[j].type == "char" )
			{
                value = mOriginal.Char( tCurPosition, tStruct.value[j].size );
			}
			else
			{
				value = mOriginal.Int( tCurPosition );
			}
			mBaseData.data.push( [ (i+1), (j+1), value ] );
        }
	}
	AddRow( mBaseData );
    OnColumnChange( tStruct );
    HideNewSheetPopup();
    Message( mSuccess, "added " + i + " rows." );
}
function OnColumnChange(ttStruct){
    let valid = false;
    var tStruct = ttStruct;
	$$("spreadsheet").attachEvent("onBeforeValueChange",function( row, column, newValue, oldValue ){
        let value;
        let sValue;
		let realColumn = column - 1;
		if( realColumn >= mColumnCount ){
			Alert( mError, "Column mismatch" );
			return false;
		}
		if( tStruct.value.length < 1 ){
			Alert( mError, "Struct is undefined" );
			return false;
		}
        tPosition = mPosition + ( tStruct.size * (row-1) );
		if( tStruct.value[realColumn].type == "char" )
		{
            sValue = newValue;
			if( newValue == "" ){
				value = new Uint8Array( tStruct.value[realColumn].size );
				sValue = "null_string";
			}
			else
			{
                value = String().Encode.encode( newValue );
				if( value.length >= tStruct.value[realColumn].size ){
					Alert( mError, `Maximun is ${(tStruct.value[realColumn].size-1)} characters for this column` );
					return false;
				}
			}
			valid = true;
			mOriginal.Replace( value, tPosition, tStruct.value[realColumn].size );
		}
		else if( tStruct.value[realColumn].type == "int" )
		{
			newValue = parseInt( newValue );
            sValue = newValue;
			if( isNaN( newValue ) ){
				Alert( mError, "can be used only numeric for this column" );
				return false;
			}
			if( newValue < 0 || newValue > 2000000000 ){
				Alert( mError, "Minimum is 0.<br/>Maximum is 2,000,000,000" );
				return false;
			}
			valid = true;
			mOriginal.Int2Array( tPosition, newValue );
		}
		if(valid){
            i = row-1;
            j = column-1;
            mBaseData.data[(i*mColumnCount) + (j) ][2] = sValue;
			winHttp.SetRuntimeData( tPosition + tStruct.value[realColumn].position, sValue, tStruct.value[realColumn].type, tStruct.value[realColumn].size );
			valid = false;
			return true;
		}
		return false;
	});
}
function HideSheet(){
    Hide("spreadsheet");
}
function HideNewSheetPopup(){
    Hide("new_sheet_popup_win");
}
function HideMonaco(){
    Hide("monaco_win");
}
/* =============== SHEET =============== */


if(desktopApp.wins)
desktopApp.ui = {
    toolbar: function(title, onHide, onMinMax, onClose ){
        var winIcon = "window-icon.png"
        var parseTitle = title.split( "|" );
        if( parseTitle.length >= 1 ){
            winIcon = parseTitle[1];
            title = parseTitle[0];
        }
        return {
            view:"toolbar",
            height:28,
            css:"window-toolbar",
            margin:0,
            padding:0,
            cols:[
                {
                    view:"label",
                    label: "<img src='img/"+winIcon+"' class='header-window-icon'/> "+title
                },
                {
                    view: "button",
                    type: "image",
                    image: "img/hide_button.png",
                    width:36,
                    height:20,
                    css:"hide-button webix_transparent",
                    on:{
                        onItemClick: onHide
                    }
                },
                {
                    view: "button",
                    type: "image",
                    image: "img/resize_button.png",
                    width:36,
                    height:20,
                    css:"resize-button webix_transparent",
                    on: {
                        onItemClick: onMinMax
                    }
                },
                {
                    view: "button",
                    type: "image",
                    image: "img/close_button.png",
                    width:36,
                    height:20,
                    css:"close-button webix_transparent",
                    on: {
                        onItemClick: onClose
                    }
                }
            ]
        };
    },
    spreadsheet:{
        id:"spreadsheet_win",
        css: "",
        toolbar: function(){
            return [
                "Spread Sheet|spreadsheet-icon.png",
                function () {
                    HideSheet();
                    webix.html.removeCss($$("spreadsheet_button").$view, "active");
                },
                function () {
                    SetFullScreen("spreadsheet_win");
                    $$("spreadsheet_win").resize();
                },function () {
                    ToolbarRemoveView("spreadsheet_button");
                    HideSheet();;
                    desktopApp.buttonCount--;
                }
            ]
        },
        body: function(){
            return {
                view:"spreadsheet",
                id:"spreadsheet",
                columnCount:mColumnCount,
                rowCount:mRowCount,
                menu: [
                    { id: "file", value: "<span class='my_option'>File</span>", submenu: [
                    { id: "new", value: "New"},
                    { id: "save", value: "Save" },
                    { id: "exporttocsv", value: "Export to CSV" }] }
                ],
                toolbar: [{ view:"toolbar", css:"webix_ssheet_toolbar", elements:[{view:"label", width:1, height:1 }] }],
                on:{
                    onColumnInit: (col) => {
                        if ( col.id <= mColumnCount ) {
                            col.header.text = mColumnName[(col.id - 1 )];
                        }
                    },
                    onMenuItemClick: function(id){
                        if(id=="file") return;
                        if(id=="new"){
                            CreateAfterLoad();
                            winHttp.GetClientList(function(){
                                desktopApp.wins.showApp( "new_sheet_popup", 450, 250 );
                            });
                        }else if(id=="save"){
                            Compress(false);
                        }else if(id=="exporttocsv"){
                            Compress(true);
                        }
                    }
                }
            }
        },
        events:{
            onBeforeShow: function(){
                SetFullScreen("spreadsheet_win");
                desktopApp.beforeWinShow("spreadsheet");
            },
        }
    },
    monaco:{
        id:"monaco_win",
        css: "",
        width: GetWidth(),
        height: GetHeight(),
        toolbar: function(){
            return [
                "Monaco Editor|monaco-icon.png",
                function () {
                    HideMonaco();
                    webix.html.removeCss($$("monaco_button").$view, "active");
                },
                function () {
                    SetFullScreen("monaco_win");
                    $$("monaco_win").resize();
                },function () {
                    ToolbarRemoveView("monaco_button");
                    HideMonaco();
                    desktopApp.buttonCount--;
                }
            ]
        },
        body: function(){
            return {
                view:"form",
                width: GetWidth(),
                height: GetHeight(),
                elements:[
                    { view:"button", id: "SaveMonaco", value: "Save", width:100, 
						click: function(){
							window.localStorage.setItem( mStoreStructKey, GetValue( "monaco" ) );
							if( CreateAfterLoad() != -1 )
							{
								Message( mSuccess, "saved" );
								ToolbarRemoveView("monaco_button");
								HideMonaco();
								desktopApp.buttonCount--;
							}
						}
					},
                    { view:"monaco-editor", id:"monaco", language:"cpp", theme:"vs-dark", value:'', width: GetWidth(), //height: desktopApp.GetHeight()-150
                    }
                ]
            }
        },
        events:{
            onBeforeShow: function(){
                SetFullScreen("monaco_win");
                desktopApp.beforeWinShow("monaco");
                $$("monaco").setValue( window.localStorage.getItem( mStoreStructKey ) );
                CreateAfterLoad();
            }
        }
    },
    new_sheet_popup:{
        id:"new_sheet_popup_win",
        css: "",
        toolbar: function(){
            return [
                "Create New Sheet|new_sheet_popup-icon.png",
                function () {
                    HideNewSheetPopup();
                    webix.html.removeCss($$("new_sheet_popup_button").$view, "active");
                },
                function () {
                    //$$("new_sheet_popup_win").config.fullscreen = !$$("new_sheet_popup_win").config.fullscreen;
                    //$$("new_sheet_popup_win").resize();
                },function () {
                    ToolbarRemoveView("new_sheet_popup_button");
                    HideNewSheetPopup();
                    desktopApp.buttonCount--;
                }
            ]
        },
        body: function(){
            return {
                view:"form",
                id:"new_sheet_popup",
                elements:[
                    mStructList,
                    mSHMList,
                    mClientList,
                    {
						view:"button", value:"Execute", css:"webix_primary", click: function(){
							winHttp.Execute();
						}
					},
                ],
            }
        },
        events:{
            onBeforeShow: function(){
                desktopApp.beforeWinShow("new_sheet_popup")
            }
        }
    }
}

