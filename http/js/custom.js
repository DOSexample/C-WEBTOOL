var zlib = window.pako;
var mStoreStructKey = "StoreStructKey";
var sendFile = "send.html", imgFile = "sendData.html";
var POST = "POST", GET = "GET";
var mError = "error";
var mSuccess = "success";
var mClientList = { view:"select", id:"ClientSelect", label: "Client", value:0, options:[] };
var mStructList = { view:"select", id:"StructSelect", label: "Struct", value:0, options:[] };
var mSHMList = { view:"select", id:"SHMSelect", label: "SHM", value:0, options:[] };
var mBaseData = {};
var mColumnCount = 0;
var mColumnName = [];
var mRowCount = 0;
var mOriginal = [];
var mOriginalSize = 0;
var mCompress = [];
var mCompressSize = 0;
var mCharSet = "utf-8";

function GetValue( id ){ if( $$(id) == undefined ) return ""; return $$(id).getValue(); }
function SetValue( id, value ){ if( $$(id) == undefined ) return ""; $$(id).setValue( value ); }
function GetWidth(){ return window.innerWidth; }
function GetHeight(){ return window.innerHeight; }
function SetFullScreen(id){
    $$(id).config.fullscreen = true;
    $$(id).config.width = GetWidth();
    $$(id).config.height = GetHeight();
}


/* =============== CUSTOM UI =============== */
function Alert( title, text ) { webix.alert({ title: title.toUpperCase(), text:text+".", width:400 }); }
function Message( type, str) { webix.message({ type:type, text:str+".", expire: 2000 }); }
function Hide(id){ if( $$(id).hasOwnProperty("config") ){ $$(id).hide(); } }
function Show(id){ if( $$(id).hasOwnProperty("config") ){ $$(id).show(); } }	
function ToolbarRemoveView(id){ $$( "toolbar" ).removeView( id ); }
/* =============== CUSTOM UI =============== */


    /* =============== DATA STRUCTURE =============== */
	var define_map = [];/* { type:"", value: } */
	
	/* Default Data Type */
	function CreateDataType(){
		define_map = [];
		define_map.push( { type:"int", name: "", value:0, size:4 } );
		define_map.push( { type:"char", name: "", value:"", size:1 } );
		ResetStructVariable();
	}
	
	/* Parse To Array */
	function ParseToArray( str ){
		let slist = str.split(/\s/g);
		slist = slist.filter( slist => slist != "" );
		return slist;
	}
	function ParseFieldToArray( str ){
		str = str.replace( ";", "" );
		
		let slist0 = str.split(/\]/);
		slist0 = slist0.filter( slist0 => slist0 != "" );
		slist0 = slist0.join().toString().replaceAll( ",", "" );
		
		let slist = slist0.split(/\[/);
		slist = slist.filter( slist => slist != "" );

		return slist;
	}
	
	/* Create Define : ex: #define ABC 123 >> #define + type + value */
	function CreateDefine( lines ){
		for( let i = 0; i < lines.length; i++ ) {
			if( lines[i].search( "#define" ) == -1 ){
				continue;
			}
			let arr = ParseToArray( lines[i] );
			if( arr.length > 3 ) {
				let str = "";
				for( let j = 2; j < arr.length; j++ ){
					str += arr[j] + " ";
				}
				arr[2] = str;
				arr.length = 3;
			}
			if( arr[0].length >= 2 && arr[0][0] == "/" && arr[0][1] == "/" ){ //comment // first string : ex: //#define
				continue;
			}
			if( arr[2].length >= 2 && arr[2][0] == "/" && arr[2][1] == "*" ){ //comment /* first string : ex: /*#define
				continue;
			}
			if( ( cmt = arr[2].search( "/" ) ) != -1 ){
				if( cmt == 0 )
					continue;
			}
			if( ( ( cmt2 = arr[2].indexOf( "/*" ) ) != -1 ) ){
				arr[2] = arr[2].substr( 0, cmt2 );
			}
			if( ( cmt3 = arr[2].indexOf( "//" ) ) != -1 ){
				arr[2] = arr[2].substr( 0, cmt3 );
			}
			arr[2] = arr[2].replaceAll( '" ', '' );
			arr[2] = arr[2].replaceAll( '"', '' );
			if( arr.length == 3 ) {
				let j;
				for( j = 0; j < define_map.length; j++ ) {
					if( define_map[j].type == arr[1] ) {
						break;
					}
				}
				if( j < define_map.length ){ /* found - duplicate defined - update */
					define_map[j] = { type: arr[1], value:arr[2], size: parseInt( arr[2] ) };
				} else { /* nout found - insert */
					define_map.push( { type: arr[1], value:arr[2], size: parseInt( arr[2] ) } );
				}
				lines[i] = "";
			}
		}
	}
	
	var typedef_struct = false;//typedef_struct
	var left_bracket = false;//{
	var right_bracket = false;//}
	function ResetStructVariable(){
		typedef_struct = false;//typedef_struct
		left_bracket = false;//{
		right_bracket = false;//}
	}
	
	function CreateFieldTemplate( type, name, value, size, position ){
		return { type: type, name: name, value: value, size: size, position: position };
	}
	function FindDataType( type ){
		for ( const [key,value] of Object.entries( define_map )) {
			if( value.type == type ){
				return CreateFieldTemplate( value.type, value.name, value.value, value.size, value.position );
			}
		}
		return undefined;
	}
	function GenerateDataType( type, name, position ){
		let data = FindDataType( type );
		if ( data == undefined ) {
			return undefined;
		}
		return CreateFieldTemplate( data.type, name, data.value, data.size, position );
	}
	function CreateStruct( lines, current = 0 ){
		current = CreateField( current, lines );
		if( current <= 0 )
		{
			return current;
		}
		if( current < lines.length ){ /* loop CreateStruct() */
			ResetStructVariable();
			return CreateStruct( lines, current );
		}
		return 0;
	}
	function AddField( field_body, data, position, old_field ){
		position += data.size;
		/* padding memory size to 4 */
		if( ( old_field == "char" && data.type != "char" ) ){
			again:
			for(;;){
				if( ( position % 4 ) != 0 ) {
					position++;
					continue again;
				}
				break;
			}
			data.position = position - 4;
		}
		/* padding memory size to 4 */
		field_body.position = position;
		field_body.push( data );
		return field_body;
	}
	function CreateField( current, lines ){
		let i, j, k, l;
		let data;
		let field_body = [];
		let position = 0;
		let isArrays;
		let old_field = "";
		for( i = current; i < lines.length; i++ ){
			let arr = ParseToArray( lines[i] );
			/* Check typedef struct */
			if( arr.length >= 2 && arr[0] == "typedef" && arr[1] == "struct" ){
				if( typedef_struct == true ){
					return -1;
				}
				typedef_struct = true;
			}
			/* Check typedef struct */
			
			/* Check left bracker { */
			if( arr.length >= 3 && arr[2].search("{") != -1 ){//typedef struct {
				if( left_bracket == true ){
					return -1;
				}
				left_bracket = true;
			}
			else if( arr.length >= 1 && arr[0].search("{") != -1 ){//new line with {
				if( left_bracket == true ){
					return -1;
				}
				left_bracket = true;
			}
			/* Check left bracker { */
			
			/* Check right bracker } */
			if( arr.length >= 1 && arr[0] == "}" ){
				if( right_bracket == true ){
					return -1;
				}
				right_bracket = true;
			}
			/* Check right bracker } */
			
			//console.log("typedef_struct:"+typedef_struct+",left_bracket:"+left_bracket+",right_bracket:"+right_bracket+",",arr);
			/* Check ready for read struct field member } */
			if( typedef_struct == false || left_bracket == false  ) { /* not found typedef struct and { */
				continue;
			}
			/* Check ready for read struct field member } */
			
			/* Add Structure to map*/
			if( right_bracket == true ){ /* end of struct - find name of struct */
				for(let z = 0; arr.length; z++ )
				{
					if( arr[z].search( ";" ) != -1 ){ /* find ; >> ex: ITEM_INFO; */
						let type_name = arr[z].replace( ";", "" );
						type_name = type_name.replace("}");
						type_name = type_name.replace("},");
						let th = CreateFieldTemplate( type_name, type_name, field_body, position/*as size*/, 0 );
						mStructList.options.push( type_name );
						define_map.push( th );
						return i+1;
					}
				}
			}
			/* Add Structure to map*/
			
			/* Check struct field member is valid? } */
			if( arr.length >= 1 && arr[0].search("{") == -1 )
			{
				if( arr[0].search( "typedef" ) == -1 )
				{
					datac = FindDataType( arr[0] );
					if( datac == undefined ){
						Alert( mError, "error undefined data type in line: " + (i+1) );
						return -1;
					}
				}
			}
			if( arr.length < 2 || ( arr.length >= 2 && ( arr[1].search( ";" ) == -1 ) ) ){ //ex: ["int", "aaa;"]
				continue;
			}
			/* Check struct field member is valid? } */
			arr[1] = ParseFieldToArray( arr[1] );			
			if( arr[1].length == 1 ){
				data = GenerateDataType( arr[0], arr[1].toString(), position );
				if( data == undefined ){
					Alert( mError, "error undefined data type in line: " + (i+1) );
					return i;
				}
			}else{//found array of field member
				let slr = arr[1];
				let arCount = 1;
				for( j = 1; j < slr.length; j++ )
				{
					let check_int = parseInt( slr[j] );
					if( isNaN( check_int ) ){ //not number
						data = FindDataType( slr[j] ); //find in define map;
						if( data == undefined ) {
							Alert( mError, "error: undefined data type in line " + (i+1) );
							return -1;
						}
						slr[j] = data.size;
					}
					arCount *= slr[j];
				}
				data = FindDataType( arr[0] );
				data.name = arr[1][0].toString();
				data.position = position;
				if( arr[0] == "char" ){
					if( slr.length == 2 ){//ex: char a[55]; --> ['a', '55']
						data.size = arCount;
						arCount /= slr[1];
					} else {//ex: int|char a[2][3][4]; --> ['a', '2', '3', '4'] multiple array
						let arCount1 = 1;
						let arCount2 = arCount;
						for( k = 1; k < ( slr.length - 1 ); k++ ) {
							arCount1 *= slr[ k ];
						}
						arCount2 = arCount / arCount1;
						arCount = arCount1;
						data.size = arCount2;
					}
				}
				if( arr[0] == "char" || arr[0] == "int" ){
					for( k = 0; k < arCount; k++ ){
						field_body = AddField( field_body, CreateFieldTemplate( data.type, data.name + ( arCount == 1 ? "" : "_" + k ), data.value, data.size, data.position ), position, old_field );						
						position = field_body.position;
						data.position = position;
						old_field = data.type;
					}
					continue;
				}
				//is structure like SKILL_INFO -> GRADE_INFO_FOR_SKILL sGradeInfo[2]
				for( k = 0; k < arCount; k++ ){
					for( l = 0; l < data.value.length; l++ ){
						field_body = AddField( field_body, CreateFieldTemplate( data.value[l].type, data.name + ( arCount == 1 ? "" : "_" + k + "." + data.value[l].name ), data.value[l].value, data.value[l].size, data.position+data.value[l].position ), position, old_field );						
						position = field_body.position;
						old_field = data.value[l].type;
					}
					data.position = position;
				}
				continue;
            }
            if( arr[0] == "char" || arr[0] == "int" ){
                field_body = AddField( field_body, data, position, old_field );
                position = field_body.position;
                old_field = data.type;
                continue;
            }
            //is structure like SKILL_INFO -> GRADE_INFO_FOR_SKILL
			for( l = 0; l < data.value.length; l++ ){
				field_body = AddField( field_body, CreateFieldTemplate( data.value[l].type, data.value[l].name, data.value[l].value, data.value[l].size, position ), position, old_field );						
				position = field_body.position;
				old_field = data.value[l].type;
                data.position = position;
            }
		}
		if( typedef_struct == true || left_bracket == true || right_bracket == true )
		{
			if( i == lines.length )
			{
				return 0;
			}
			Alert( mError, "error CreateStruct() in line " + i);//(i-1) );
			return -1;
		}
		return 0;
	}
	function CreateSHMList(){
		let options = [];
		for ( const [key,value] of Object.entries( define_map )) {
			if( ( value.type.search( "SHAREMEM" ) != -1 ) && ( value.type.search( "_KEY" ) == -1 ) ){
				options.push( value.type );
			}
		}
		mSHMList.options = options;
	}
	function GetPatternKey( shm ){
		for ( const [key,value] of Object.entries( define_map )) {
			if( value.type.search( shm+"_KEY" ) != -1 ){
				return value.value;
			}
		}
		return "";
	}
	function GetStruct( tStruct ){
        for( let i = 0; i < define_map.length; i++ ){
            if( define_map[i].type == tStruct ){
                return define_map[i];
            }
        }
		return { size:0 };
	}
	function CreateAfterLoad(){
		var data = window.localStorage.getItem( mStoreStructKey );
		if( data === null || data === undefined ){
			data = "";
		}
		mStructList.options = [];
		CreateDataType();
		CreateDefine( data.split("\r").toString().split("\n") );
		var result = CreateStruct( data.split("\r").toString().split("\n") );
		CreateSHMList();
		console.log( define_map );
		return result;
    }
    //window.onload = CreateAfterLoad;
    /* =============== DATA STRUCTURE =============== */

    /* =============== Compress/Uncompress =============== */
	function Uncompress( data ){
		mOriginalSize = data.slice( 0, 4 ).Int();
		mCompressSize = data.slice( 4, 8 ).Int();
		mCompress = data.slice( 8, data.byteLength );
		mOriginal = zlib.inflate( mCompress );
		if( mOriginalSize != mOriginal.byteLength ){
			Alert( mError, "uncompressing : data size mismatch" );
			return false;
		}
		return true;
	}
	function Compress( toCSV )
	{
		var tCompress;
		if( !toCSV )
		{
			winHttp.SaveData();
			return;
		}

		tStruct = GetValue( mStructList.id );
		if( tStruct == "" )
		{
			Alert( mError, "undefined structure or data is null" );
			return;
		}
		tStruct = GetStruct( tStruct );
		if( tStruct.size == 0 )
		{
			Alert( mError, "stucture size is 0" );
			return;
		}

		let l;
		let temp_file_name = tStruct.type;
		Message( mSuccess, "Exporting..." );
		tCompress = "";
		setTimeout(function(){

		for( let j = 0; j < mColumnCount; j++ )
		{
			tCompress += mColumnName[j];
			if( j != ( mColumnCount - 1 ) ){
				tCompress += "|";
			}
		}
		tCompress += "\n";
		for( let i = 0; i < mRowCount; i++ )
		{
			for( let j = 0; j < mColumnCount; j++ )
			{
				tCompress += mBaseData.data[(i*mColumnCount) + (j) ][2];
				if( j != ( mColumnCount - 1 ) ){
					tCompress += "|";
				}
			}
			tCompress +="\n";
		}
		l = temp_file_name.indexOf(".");
		if( l != -1 )
		{
			temp_file_name = temp_file_name.substring( 0, l );
		}
		temp_file_name += ".CSV";
		let blob = new Blob( [tCompress] , { type : "text/plain;charset="+mCharSet+";" } );
		let a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = temp_file_name;
		a.click();		
		Message( mSuccess, "Exported..." );

		}, 500 );
	}
    /* =============== Compress/Uncompress =============== */
	
    /* =============== PROTOTYPE =============== */
	ArrayBuffer.prototype.Int = function(){
		return new Uint8Array(this).Int(0);
	}
	Uint8Array.prototype.Int = function(position){
		return this[position] << 32 | (this[position+3] << 24) | (this[position+2] << 16) | (this[position+1] << 8);
	}
	Uint8Array.prototype.Int2Array = function( position, value ){
		this[position] =   ( value & 0X000000FF )      ;
		this[position+1] = ( value & 0X0000FF00 ) >>  8;
		this[position+2] = ( value & 0x00FF0000 ) >> 16;
		this[position+3] = ( value & 0xFF000000 ) >> 24;
	}
	Uint8Array.prototype.Char = function( position, len ){
		if( this[position] == 0x00 ){
			return "";
		}
		for( let i = position; i < len; i++ ){
			if( this[i] == 0x00 ){
				len = i-position;
				break;
			}
		}
		return this.Decode.decode( this.slice( position, position+len ) );
	}
	Uint8Array.prototype.Replace = function( data, position, len ){
		for( let i = 0; i < len; i++ ){
			if( i < data.byteLength )
				this[i+position] = data[i];
			else
				this[i+position] = 0x00;
		}
	}
	Uint8Array.prototype.PushFront = function( size, data ){
		var ar = new Uint8Array( size + data.byteLength );
		for( let i = 0; i < data.byteLength; i++ )
		{
			ar[i+size] = data[i];
		}
		return ar;
	}
	Uint8Array.prototype.PushBack = function( size, data ){
		var ar = new Uint8Array( size + data.byteLength );
		for( let i = 0; i < data.byteLength; i++ )
		{
			ar[i] = data[i];
		}
		return ar;
	}
	//GBK = Chineese Text Format
	//CP949 or Windows-949 = Korean Text Format
	//UTF-8 or utf8 = Normal Text Format
	//Windows-874
	var Decode = new TextDecoder( mCharSet );
	var Encode = new TextEncoder( mCharSet );
	Uint8Array.prototype.Decode = Decode;
	String.prototype.Encode = Encode;
    /* =============== PROTOTYPE =============== */