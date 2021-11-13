#include <windows.h>
#include <psapi.h>
#include "server_fpattern.c"

#define MAX_PATH	260
#define BUFFER_SIZE (10240)
#define HLEVEL_INFO		0
#define HITEM_INFO		1
#define HSKILL_INFO		2
#define HMONSTER_INFO	3
#define HNPC_INFO		4
#define HQUEST_INFO		5
#define HSUMMON_INFO	6
#define HBUFFER_COUNT	7


BYTE* hMapBuffer = NULL;
DWORD hCurrentBufferNum = -1;
HANDLE hMapFile = NULL;
DWORD hMapSize = 0;
HANDLE hClientProcess = NULL;
DWORD hProcessId = 0;
DWORD hClientAddr = 0;
BYTE* hClientBuffer = NULL;
char hProcessName[BUFFER_SIZE];

BOOL bIsZlibLoaded = FALSE;
typedef int (*compressBoundZ)( int );
typedef int (*compress2Z)( BYTE*, DWORD*, const BYTE*, DWORD, int );
compressBoundZ compressBound;
compress2Z compress2;

BOOL LoadZLib()
{
	if( bIsZlibLoaded )
	{
		return TRUE;
	}
	HMODULE hModule = LoadLibraryA( "./zlib1.dll" );
	if( !hModule )
	{
		printf( "Could not load zlib1.dll\n" );
		return FALSE;
	}
	compressBound = (compressBoundZ)GetProcAddress( hModule, "compressBound" );
	if( !compressBound )
	{
		printf( "Could not load function compressBound()\n" );
		return FALSE;
	}
	compress2 = (compress2Z)GetProcAddress( hModule, "compress2" );
	if( !compress2 )
	{
		printf( "Could not load function compress2()\n" );
		return FALSE;
	}
	bIsZlibLoaded = TRUE;
	return TRUE;
}
BOOL Compress( DWORD* tCompressSize, BYTE* tCompress, DWORD tOriginalSize, BYTE* tOriginal )
{
	#define Z_OK            		0
	#define Z_NO_COMPRESSION		0
	#define Z_BEST_SPEED			1
	#define Z_BEST_COMPRESSION		9
	#define Z_DEFAULT_COMPRESSION	(-1)
	if( !LoadZLib() )
	{
		return FALSE;
	}
	int lCompressSize = compressBound( tOriginalSize );
	if ( compress2( (BYTE*)tCompress, (DWORD*)&lCompressSize, (const BYTE*)tOriginal, tOriginalSize, Z_BEST_COMPRESSION ) != Z_OK )
	{
		return FALSE;
	}
	*tCompressSize = lCompressSize;
	return TRUE;
}
char* SaveData( char* tFileName1 )
{
	char tFileName[MAX_PATH];
	BYTE* tCompress;
	DWORD tCompressSize;
	DWORD tOriginalSize = hMapSize;
	DWORD nWriteByte;
	HANDLE hFile;
	if( hMapBuffer == NULL )
	{
		return strdup( "error|data is null" );
	}
	tCompress = (BYTE*)GlobalAlloc( GMEM_FIXED, ( hMapSize / 2 ) );
	if( tCompress == NULL )
	{
		return strdup( "error|Could not alloc memory for writing" );
	}
	if ( !Compress( &tCompressSize, tCompress, tOriginalSize, hMapBuffer ) )
	{
		return strdup( "error|Could not create compress" );
	}
	sprintf( tFileName, "http/%s", tFileName1 );
	hFile = CreateFile( tFileName, GENERIC_WRITE, FILE_SHARE_WRITE, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL );
	if( hFile == INVALID_HANDLE_VALUE )
	{
		return strdup( "error|Could not create file data" );
	}
	if ( !WriteFile( hFile, &tOriginalSize, 4, &nWriteByte, NULL ) )
	{
		CloseHandle( hFile );
		return strdup( "error|Could not write file data1" );
	}
	if( nWriteByte != 4 )
	{
		CloseHandle( hFile );
		return strdup( "error|Could not write file data1.1" );
	}
	if ( !WriteFile( hFile, &tCompressSize, 4, &nWriteByte, NULL ) )
	{
		CloseHandle( hFile );
		return strdup( "error|Could not write file data2" );
	}
	if( nWriteByte != 4 )
	{
		CloseHandle( hFile );
		return strdup( "error|Could not write file data2.1" );
	}
	if ( !WriteFile( hFile, tCompress, tCompressSize, &nWriteByte, NULL ) )
	{
		CloseHandle( hFile );
		return strdup( "error|Could not write file data3" );
	}
	if( nWriteByte != tCompressSize )
	{
		CloseHandle( hFile );
		return strdup( "error|Could not write file data3.1" );
	}
	if( !CloseHandle( hFile ) )
	{
		return strdup( "error|Could not close handle file" );
	}
	return strdup( "" );
}

void CloseSHM()
{
	if( hMapBuffer )
	{
		UnmapViewOfFile( hMapBuffer );
	}
	if( hMapFile )
	{
		CloseHandle( hMapFile );
	}
}
char* OpenSHM( char* structName, char* szName, int szSize, BOOL szGetRow, int* szRow )
{
	char retval[MAX_PATH] = {0};
	int tBufferNum;

	printf( "%s\n", structName );
	if( strstr( structName, "LEVEL_INFO" ) ){
		tBufferNum = HLEVEL_INFO;
	} else if( strstr( structName, "ITEM_INFO" ) ){
		tBufferNum = HITEM_INFO;
	} else if( strstr( structName, "SKILL_INFO" ) ){
		tBufferNum = HSKILL_INFO;
	} else if( strstr( structName, "MONSTER_INFO" ) ){
		tBufferNum = HMONSTER_INFO;
	} else if( strstr( structName, "NPC_INFO" ) ){
		tBufferNum = HNPC_INFO;
	} else if( strstr( structName, "QUEST_INFO" ) ){
		tBufferNum = HQUEST_INFO;
	} else if( strstr( structName, "SUMMON_INFO" ) ){
		tBufferNum = HSUMMON_INFO;
	} else {
		return strdup( "error|Unknow Struct" );
	}
	hCurrentBufferNum = tBufferNum;
	hMapFile = OpenFileMapping( FILE_MAP_ALL_ACCESS, FALSE, szName );
	if ( hMapFile == NULL )
	{
		sprintf( retval, "error|Could not open file mapping object (%d).\n", GetLastError() );
		return strdup( retval );
	}
	hMapBuffer = (BYTE*)MapViewOfFile( hMapFile, FILE_MAP_ALL_ACCESS, 0, 0, szSize );
	if ( hMapBuffer == NULL )
	{
	   CloseHandle( hMapFile );
	   sprintf( retval, "error|Could not map view of file (%d).\n", GetLastError() );
	   return strdup(retval);
	}
	if( szGetRow )
	{
		*szRow = *(int*)&hMapBuffer[0];
		CloseSHM();
	}
	return strdup( retval );
}

void PrintProcessNameAndID( DWORD processID )
{
    CHAR szProcessName[MAX_PATH] = "<unknown>";
    HANDLE hProcess = OpenProcess( PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, FALSE, processID );
    if ( NULL != hProcess )
    {
        HMODULE hMod;
        DWORD cbNeeded;
        if ( EnumProcessModules( hProcess, &hMod, sizeof(hMod), &cbNeeded) )
        {
            GetModuleBaseName( hProcess, hMod, szProcessName, sizeof(szProcessName)/sizeof(TCHAR) );
			if( ( strstr( szProcessName, "TwelveSky" ) != NULL ) ){
				sprintf( szProcessName, "%s, pid:%u\n", szProcessName, processID );
				strcat( hProcessName, szProcessName );
			}
        }
    }
    CloseHandle( hProcess );
}

char* GetProcList( void )
{
    DWORD aProcesses[1024], cbNeeded, cProcesses;
    unsigned int i;
	ZeroMemory( hProcessName, BUFFER_SIZE );
    if ( !EnumProcesses( aProcesses, sizeof(aProcesses), &cbNeeded ) )
    {
        return strdup( "" );
    }
    cProcesses = cbNeeded / sizeof(DWORD);
    for ( i = 0; i < cProcesses; i++ )
    {
        if( aProcesses[i] != 0 )
        {
            PrintProcessNameAndID( aProcesses[i] );
        }
    }
	if( strlen( hProcessName ) > 0 && hProcessName[( strlen( hProcessName ) - 1 )] == ',' ){
		hProcessName[( strlen( hProcessName ) - 1 )] = '\0';
	}
    return strdup( hProcessName );
}

HANDLE OpenClientProcess( DWORD dwDesiredAccess )
{
	hClientProcess = OpenProcess( dwDesiredAccess, FALSE, hProcessId );
	return hClientProcess;
}
char* SetProcHandle( DWORD processId )
{
	char retval[MAX_PATH] = {0};
	hProcessId = processId;	
	if( OpenClientProcess( PROCESS_ALL_ACCESS ) == NULL )
	{
		sprintf( retval, "error|Could not open process (%d).\n", GetLastError() );
		return strdup(retval);
	}
	CloseHandle( hClientProcess );
	return strdup( "success|opened process.\n" );
}
char* WriteToClient( int szClientPosition, int szServerPosition, int szSize )
{
	char retval[MAX_PATH] = {0};
	
	printf( "%d:%d:%d\n", szClientPosition, szServerPosition, szSize );
	if( OpenClientProcess( PROCESS_ALL_ACCESS | PROCESS_VM_WRITE ) == NULL )
	{
		sprintf( retval, "error|Could not open process (%d).\n", GetLastError() );
		return strdup( retval );
	}
	if( hMapBuffer == NULL )
	{
		return strdup( "error|SHM is null" );
	}
	if( !WriteProcessMemory( hClientProcess, (LPVOID)(hClientAddr + szClientPosition), (LPCVOID)(hMapBuffer + szServerPosition), szSize, NULL ) )
	{
		sprintf( retval, "error|!WriteProcessMemory() (%d)\n", GetLastError() );
		return strdup( retval );
	}
	CloseHandle( hClientProcess );
	return strdup( "" );
}
char* ExecuteAndLoad( DWORD processID, char* structName, char* structSize, char* shmName, char* patternKey )
{
	char retval[MAX_PATH] = {0};
	int szSize = atoi( &structSize[0] );
	int szRow;
	DWORD nReadBytes;

	//close shm first, if it is valid
	if( hMapBuffer )
	{
		CloseSHM();
	}
	//open shm to get row count and close shm = 4 bytes
	strcpy( retval, OpenSHM( structName, shmName, szSize, TRUE, &szRow ) );
	if( strlen( retval ) != 0 )//error
	{
		return strdup( retval );	
	}
	//open real shm
	hMapSize = 4 + ( szSize * szRow ); // rows + ( struct size * rows )
	strcpy( retval, OpenSHM( structName, shmName, hMapSize, FALSE, &szRow ) );
	if( strlen( retval ) != 0 )//error
	{
		return strdup( retval );	
	}

	hProcessId = processID;
	//open for find pattern
	if( OpenClientProcess( PROCESS_ALL_ACCESS | PAGE_EXECUTE_READWRITE ) == NULL )
	{
		sprintf( retval, "error|Could not open process - 2 - (%d).\n", GetLastError() );
		return strdup(retval);
	}
	int tReadStartCount  = 0;
	int tReadEndCount  = 100;//try x times
	while( ( ( hClientAddr = FindPattern( hClientProcess, hProcessId, patternKey ) ) == 0 ) && ( tReadStartCount < tReadEndCount ) )
	{
		tReadStartCount++;
		Sleep(1);
	}
	if( hClientAddr == 0 )
	{
		CloseHandle( hClientProcess );
		return strdup( "error|can not find memory address\n" );
	}
	CloseHandle( hClientProcess );

	hClientAddr += 4;//real position

	//open for read
	if( OpenClientProcess( PROCESS_ALL_ACCESS | PROCESS_VM_READ ) == NULL )
	{
		sprintf( retval, "error|Could not open process - 3 - (%d).\n", GetLastError() );
		return strdup( retval );
	}

	printf( "hCurrentBufferNum:%d\nhClientAddr:%08X\n", hCurrentBufferNum, hClientAddr );

	//real client address
	if( hCurrentBufferNum == HLEVEL_INFO ){
		hClientAddr += 8;
	}else{
		DWORD tClientAddress;
		ReadProcessMemory( hClientProcess, (LPVOID)hClientAddr, (LPVOID)&tClientAddress, 4, &nReadBytes );
		if ( nReadBytes == 0 )
		{
			CloseHandle( hClientProcess );
			return strdup( "error|can not read test memory address\n" );
		}
		hClientAddr = tClientAddress;	
	}

	hClientBuffer = (BYTE*)GlobalAlloc( GMEM_FIXED, hMapSize );
	if( hClientBuffer == NULL )
	{
		sprintf( retval, "error|Could not alloc memory for read (%d).\n", GetLastError() );
		return strdup( retval );
	}
	
	printf( "hClientAddr:%08X\n", hClientAddr );

    ReadProcessMemory( hClientProcess, (LPVOID)hClientAddr, (LPVOID)hClientBuffer, hMapSize, &nReadBytes );
    if ( nReadBytes == 0 )
    {
		CloseHandle( hClientProcess );
        return strdup( "error|can not read test memory address\n" );
    }
	CloseHandle( hClientProcess );
	
	strcpy( retval, WriteToClient( 0, 4, hMapSize ) );
	if( strlen( retval ) > 0 )
	{
		return strdup( retval );
	}
	strcpy( retval, SaveData( "sendData.html" ) );
	if( strlen( retval ) > 0 )
	{
		return strdup( retval );
	}
	sprintf( retval, "success|Adding rows.." );
	return strdup( retval );
}

char* SetRuntimeValue( int position, char* type, char* value, int size )
{
	char retval[MAX_PATH] = {0};
	if( hMapFile == INVALID_HANDLE_VALUE )
	{
		return strdup( "error|SHM is not open" );
	}
	if( hMapBuffer == NULL )
	{
		return strdup( "error|SHM buffer is not valid" );
	}
	if( strcmp( type, "char" ) == 0 )
	{
		ZeroMemory( &hMapBuffer[position], size );
		if( strcmp( value, "null_string" ) != 0 ){
			CopyMemory( &hMapBuffer[position], value, strlen( value ) );
		}
	} else {
		int real_value = atoi( value );
		CopyMemory( &hMapBuffer[position], &real_value, size );
	}
	strcpy( retval, WriteToClient( position-4, position, size ) );
	if( strlen( retval ) > 0 )
	{
		return strdup( retval );
	}
	sprintf( retval, "success|%s", value );
	return strdup( retval );
}