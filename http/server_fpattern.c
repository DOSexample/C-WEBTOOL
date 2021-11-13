#include <windows.h>
#define INRANGE(x,a,b)    (x >= a && x <= b) 
#define getBits( x )    (INRANGE((x&(~0x20)),'A','F') ? ((x&(~0x20)) - 'A' + 0xa) : (INRANGE(x,'0','9') ? x - '0' : 0))
#define getByte( x )    (getBits(x[0]) << 4 | getBits(x[1]))
PBYTE FindPatternEx( const PBYTE rangeStart, const PBYTE rangeEnd, const char* pattern )
{
	const unsigned char* pat = (const unsigned char*)(pattern);
	PBYTE firstMatch = 0;
	for (PBYTE pCur = rangeStart; pCur < rangeEnd; ++pCur) {
		if (*(PBYTE)pat == (BYTE)'\?' || *pCur == getByte(pat)) {
			if (!firstMatch) {
				firstMatch = pCur;
			}
			pat += (*(PWORD)pat == (WORD)'\?\?' || *(PBYTE)pat != (BYTE)'\?') ? 3 : 2;
			if (!*pat) {
				return firstMatch;
			}
		}
		else if (firstMatch) {
			pCur = firstMatch;
			pat = (const unsigned char*)(pattern);
			firstMatch = 0;
		}
	}
	return NULL;
}
#define CHUNCK_SIZE	4096
DWORD FindPattern( HANDLE hProcess, DWORD processID, char *pattern )
{
	DWORD start = 0x00800000;
	DWORD end   = 0x008fffff;
	DWORD currentChunk = start;
    SIZE_T bytesRead;
	DWORD oldprotect;
	BYTE buffer[CHUNCK_SIZE];
	DWORD InternalAddress;
	DWORD offsetFromBuffer;
    while ( currentChunk < end )
    {
        if( !VirtualProtectEx( hProcess, (void*)currentChunk, CHUNCK_SIZE, PAGE_EXECUTE_READWRITE, &oldprotect ) )
		{
			return 0;
		}
        ReadProcessMemory( hProcess, (void*)currentChunk, &buffer, CHUNCK_SIZE, &bytesRead );
        if ( bytesRead == 0 )
        {
            return 0;
        }
		InternalAddress = (DWORD)(FindPatternEx( (PBYTE)buffer, (PBYTE)(buffer+CHUNCK_SIZE), pattern));
        if ( InternalAddress != 0 )
        {
			offsetFromBuffer = InternalAddress - (DWORD)&buffer;
            return currentChunk + offsetFromBuffer;
        }
        else
        {
            currentChunk = currentChunk + bytesRead;
        }
    }
    return 0;
}