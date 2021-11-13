winHttp = {};
winHttp.packetDone = false;
winHttp.CreateRequest = function(){
    var oReq = new XMLHttpRequest();
    oReq.open( POST, sendFile, true );
    return oReq;
}
winHttp.ParseRespone = function( oReq ){
    var response = "";
    let begin_length = "response-begin:".length
    let res_begin = oReq.responseText.search( "response-begin:" );
    let res_end = oReq.responseText.search( "response-end" );
    if( res_begin != -1 && res_end != -1 ){
        response = oReq.responseText.substr( res_begin + begin_length, res_end - res_begin - begin_length );
    }
    return response;
}
winHttp.GetClientList = function( callback ){
    var oReq = winHttp.CreateRequest();
    oReq.setRequestHeader( "data-work", "get-client-process" );
    oReq.onload = function(e) {
        let response = winHttp.ParseRespone( oReq );
        if( response != "" ){
            let options = response.split( "\n" );
            options = options.filter( options => options != "" );
            mClientList.options = options;
        }
		if(typeof callback === "function")
			callback();
    }
    oReq.send();
}
winHttp.Execute = function(){
    tStruct = GetValue( mStructList.id );
    tSHM = GetValue( mSHMList.id );
    tClient = GetValue( mClientList.id );
    if( tStruct == "" ){
        Alert( mError, "Please create struct" );
        return;
    }
    tStruct = GetStruct( tStruct );
    if( tSHM == "" ){
        Alert( mError, "Please set SHAREMEM" );
        return;
    }
    patternKey = GetPatternKey( tSHM );
    if( patternKey == "" ){
        Alert( mError, "Please set #define " + tSHM + "_KEY" );
        return;
    }
    if( tClient == "" ){
        Alert( mError, "client not found" );
        return;
    }
    tPID = tClient.indexOf( "pid:" );
    if( tPID == -1 ){
        Alert( mError, "client-pid not found" );
        return;
    }
    tClient = parseInt( tClient.substr( tPID + 4, tClient.length - 4 ) );
    if( isNaN( tClient ) ){
        Alert( mError, "client-nan not found" );
        return;
    }
    var oReq = winHttp.CreateRequest();
    oReq.setRequestHeader( "data-work", "set-execute" );
    oReq.setRequestHeader( "data-pid", tClient );
    oReq.setRequestHeader( "data-struct-name", tStruct.name );
    oReq.setRequestHeader( "data-struct-size", tStruct.size );		
    oReq.setRequestHeader( "data-shm-name", tSHM );
    oReq.setRequestHeader( "data-pattern-key", patternKey );
    oReq.onload = function(e) {
        let response = winHttp.ParseRespone( oReq );
        if( response != "" ){
            let txt = response.split( "|" );
            if( txt[0] != "" ){
                Message( txt[0], txt[1] );
            }
            if( txt[0] == mSuccess ){
                var oReq2 = new XMLHttpRequest();
                oReq2.open( GET, imgFile, true );
                oReq2.responseType = "arraybuffer";
                oReq2.onload = function(e) {
                    if (oReq2.response) { // Note: not oReq.responseText
                        if( Uncompress(oReq2.response) ){
                            setTimeout( CreateSheet(), 100 );//Add data to sheet
                        }
                    }
                }
                oReq2.send();
            }
        }
    }
    Message( mSuccess, "Executing..." );
    HideNewSheetPopup();
    oReq.send();
}
winHttp.SetRuntimeData = function( position, data, type, size, struct, row ){
    tStruct = GetValue( mStructList.id );
    if( tStruct == "" ){
        Alert( mError, "Undefined structure to set data" );
        return;
    }
    tStruct = GetStruct( tStruct );
    if( ( ( tStruct.size * mRowCount ) + 4 ) != mOriginal.byteLength ){
        Alert( mError, "Struct size mismatch" );
        return;
    }
    var oReq = winHttp.CreateRequest();
    oReq.setRequestHeader( "data-work", "set-runtime-data" );
    oReq.setRequestHeader( "data-position", position );
    oReq.setRequestHeader( "data-value", data.toString() );
    oReq.setRequestHeader( "data-type", type );
    oReq.setRequestHeader( "data-size", size );
    oReq.onload = function(e) {
        let response = winHttp.ParseRespone( oReq );
        if( response != "" ){
            let txt = response.split( "|" );
            if( txt[0] != "" ){
                Message( txt[0], txt[1] );
            }
        }
    }
    oReq.send();
}
winHttp.SaveData = function(){
    tStruct = GetValue( mStructList.id );
    if( tStruct == "" ){
        Alert( mError, "undefined structure or data is null" );
        return;
    }
    tStruct = GetStruct( tStruct );
    if( ( ( tStruct.size * mRowCount ) + 4 ) != mOriginal.byteLength ){
        Alert( mError, "Struct size mismatch" );
        return;
    }
    Message( mSuccess, "Saving..." );
    setTimeout(function(){
    
    var oReq = winHttp.CreateRequest();
    oReq.setRequestHeader( "data-work", "save-data" );
    oReq.setRequestHeader( "data-file-name", ( tStruct.type + ".IMG" ) );
    oReq.onload = function(e) {
        let response = winHttp.ParseRespone( oReq );
        if( response != "" ){
            let txt = response.split( "|" );
            if( txt[0] != "" ){
                Message( txt[0], txt[1] );
            }
        }
    }
    oReq.send();

    }, 500 );
}